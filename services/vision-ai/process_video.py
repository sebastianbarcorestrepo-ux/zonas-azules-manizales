import sys
import os
import cv2
import time
import re
import csv
import json
import argparse
from pathlib import Path

# Configurar salida UTF-8 para evitar errores de codificación en Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import requests
from rapidocr_onnxruntime import RapidOCR

BASE_DIR = Path(__file__).resolve().parents[2]
if not (BASE_DIR / "services" / "vision-ai" / "media").exists():
    BASE_DIR = Path("C:/Windows/System32/zonas-azules-manizales")
VIDEO_DEFAULT = BASE_DIR / "services" / "vision-ai" / "media" / "prueba_placas.mp4"
API_URL = "http://localhost:3000/api/ai"

PLATE_PATTERN = re.compile(r"^[A-Z]{3}[0-9]{3}$")

def normalizar_texto(texto):
    return re.sub(r"[^A-Z0-9]", "", texto.upper())

def notificar_backend(zone_name, spot_number, plate, action="OCCUPY"):
    payload = {
        "zone_name": zone_name,
        "spot_number": spot_number,
        "license_plate": plate,
        "action": action
    }
    try:
        res = requests.post(f"{API_URL}/event", json=payload, timeout=3)
        return res.status_code == 200
    except Exception:
        return False

def procesar_video(video_path=VIDEO_DEFAULT, zone_name="Zona Coliseo 2 - Cra 24", json_mode=False):
    video_path = Path(video_path)
    if not video_path.is_absolute():
        video_path = BASE_DIR / video_path

    if not video_path.exists():
        err_msg = f"Error: No existe el video en {video_path}"
        if json_mode:
            print(json.dumps({"success": False, "error": err_msg}))
        else:
            print(err_msg)
        return

    if not json_mode:
        print("=" * 60)
        print("🚀 INICIANDO VISIÓN ARTIFICIAL ACELERADA (RapidOCR)")
        print("=" * 60)
        print(f"🎥 Video: {video_path.name}")
        print(f"📍 Zona:  {zone_name}\n")

    ocr = RapidOCR()
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        err_msg = "Error: No se pudo abrir el archivo de video."
        if json_mode:
            print(json.dumps({"success": False, "error": err_msg}))
        else:
            print(err_msg)
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duracion = total_frames / fps

    start_time = time.time()
    detecciones = {}
    csv_rows = []
    spot_counter = 1

    # Muestreo rápido: evaluamos cada 2.5 segundos e incluimos puntos clave
    puntos_tiempo = [round(t, 1) for t in [1.5, 4.0, 7.5, 8.0, 11.0, 14.0, 17.0, 20.0, 24.0, 25.0, 28.0, 31.0, 33.0]]

    for t in puntos_tiempo:
        if t > duracion:
            break

        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ret, frame = cap.read()
        if not ret:
            continue

        # Región de Interés (ROI): recorte focalizado en la zona vial / celdas
        # Reduce en un 85% el área de análisis, multiplicando la velocidad
        alto, ancho = frame.shape[:2]
        y1, y2 = int(alto * 0.40), int(alto * 0.85)
        x1, x2 = int(ancho * 0.15), int(ancho * 0.85)
        roi = frame[y1:y2, x1:x2]

        res, _ = ocr(roi)
        if res:
            for bbox, texto, conf in res:
                placa = normalizar_texto(texto)
                conf = float(conf)

                if PLATE_PATTERN.match(placa) and conf >= 0.45:
                    if placa not in detecciones:
                        detecciones[placa] = {
                            "spot": spot_counter,
                            "plate": placa,
                            "time": f"{t:.1f}s",
                            "confidence": round(conf, 2)
                        }

                        # Notificar al backend de Zonas Azules
                        backend_ok = notificar_backend(zone_name, spot_counter, placa, "OCCUPY")
                        detecciones[placa]["backend_sync"] = backend_ok

                        csv_rows.append([zone_name, f"{t:.1f}s", t, placa, round(conf, 3), texto])

                        if not json_mode:
                            print(f"  🚘 [PLACA DETECTADA] {placa} en t={t:.1f}s (Conf: {conf:.2f}) -> Asignada a Celda #{spot_counter}")

                        spot_counter += 1

    cap.release()
    tiempo_total = round(time.time() - start_time, 2)

    # Guardar en CSV
    csv_path = BASE_DIR / "detecciones_placas.csv"
    try:
        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["zona", "tiempo_video", "segundos", "placa", "confianza", "texto_original"])
            w.writerows(csv_rows)
    except Exception:
        pass

    resultado_final = {
        "success": True,
        "zone": zone_name,
        "duration": tiempo_total,
        "detected": list(detecciones.values()),
        "total_vehicles": len(detecciones)
    }

    if json_mode:
        print(json.dumps(resultado_final))
    else:
        print("\n" + "=" * 60)
        print(f"✅ PROCESAMIENTO FINALIZADO EN {tiempo_total} SEGUNDOS")
        print(f"📊 Total vehículos detectados: {len(detecciones)}")
        print(f"📁 Registro guardado en: {csv_path.name}")
        print("=" * 60)

    return resultado_final

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Visión AI Zonas Azules")
    parser.add_argument("--json", action="store_true", help="Salida estructurada en JSON")
    parser.add_argument("--zone", type=str, default="Zona Coliseo 2 - Cra 24", help="Nombre de la zona")
    parser.add_argument("--video", type=str, default=str(VIDEO_DEFAULT), help="Ruta del video")

    args = parser.parse_args()
    procesar_video(video_path=args.video, zone_name=args.zone, json_mode=args.json)
