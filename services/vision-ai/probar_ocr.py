
import cv2
import easyocr
import time
import re
from pathlib import Path
from collections import Counter

VIDEO = Path("services/vision-ai/media/prueba_placas.mp4")
SALIDA = Path("services/vision-ai/resultados_ocr.txt")

PLACAS_ESPERADAS = ["NXO810", "GTL664", "GNP684", "GET298"]

# Procesar aproximadamente 2 fotogramas por segundo
FOTOGRAMAS_POR_SEGUNDO = 2

def normalizar(texto):
    return re.sub(r"[^A-Z0-9]", "", texto.upper())

def main():
    if not VIDEO.exists():
        print(f"ERROR: No se encuentra el video: {VIDEO}")
        print("Comprueba el nombre y la ubicación del archivo.")
        return

    print("Abriendo video...")
    cap = cv2.VideoCapture(str(VIDEO))

    if not cap.isOpened():
        print("ERROR: No se pudo abrir el video.")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if fps <= 0 or total_frames <= 0:
        print("ERROR: No se pudieron leer los datos del video.")
        cap.release()
        return

    duracion = total_frames / fps
    salto = max(1, round(fps / FOTOGRAMAS_POR_SEGUNDO))

    print(f"Duración: {duracion:.1f} segundos")
    print(f"Fotogramas totales: {total_frames}")
    print(f"Analizando aproximadamente {FOTOGRAMAS_POR_SEGUNDO} fotogramas/segundo.")
    print("Cargando EasyOCR en CPU...")

    reader = easyocr.Reader(["en"], gpu=False)
    conteo = Counter()
    registros = []
    inicio = time.time()
    frame_num = 0
    analizados = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_num % salto == 0:
                segundo = frame_num / fps
                alto, ancho = frame.shape[:2]

                # Reducir resolución para acelerar OCR
                escala = min(1.0, 1280 / ancho)
                if escala < 1.0:
                    frame = cv2.resize(
                        frame,
                        (int(ancho * escala), int(alto * escala))
                    )

                resultados = reader.readtext(
                    frame,
                    detail=1,
                    paragraph=False
                )

                textos_frame = []

                for caja, texto, confianza in resultados:
                    limpio = normalizar(texto)

                    if len(limpio) >= 5 and confianza >= 0.20:
                        conteo[limpio] += 1
                        textos_frame.append(
                            f"{limpio} (confianza {confianza:.2f})"
                        )
                        registros.append(
                            f"{segundo:.2f}s | {limpio} | confianza={confianza:.2f}"
                        )

                if textos_frame:
                    print(f"[{segundo:5.1f}s] " + " | ".join(textos_frame))
                else:
                    print(f"[{segundo:5.1f}s] Sin texto reconocido")

                analizados += 1
                if analizados % 5 == 0:
                    porcentaje = frame_num * 100 / total_frames
                    print(f"Progreso aproximado: {porcentaje:.0f}%")

            frame_num += 1

    finally:
        cap.release()

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    with SALIDA.open("w", encoding="utf-8") as archivo:
        archivo.write("RESULTADOS DEL RECONOCIMIENTO OCR\n")
        archivo.write(f"Video: {VIDEO}\n")
        archivo.write(f"Duración: {duracion:.2f} segundos\n\n")
        archivo.write("LECTURAS POR TIEMPO\n")
        archivo.write("\n".join(registros))
        archivo.write("\n\nFRECUENCIA DE TEXTOS\n")

        for texto, cantidad in conteo.most_common():
            archivo.write(f"{texto}: {cantidad}\n")

    print("\n--- RESUMEN ---")
    print(f"Fotogramas analizados: {analizados}")
    print(f"Tiempo de ejecución: {time.time() - inicio:.1f} segundos")
    print(f"Archivo de resultados: {SALIDA}")

    print("\nComparación con las placas esperadas:")
    textos_detectados = list(conteo.keys())

    for placa in PLACAS_ESPERADAS:
        coincidencias = [
            texto for texto in textos_detectados
            if texto == placa or (
                len(texto) >= 5 and
                (texto in placa or placa in texto)
            )
        ]

        if coincidencias:
            print(f"[REVISAR] {placa}: coincidencias {coincidencias}")
        else:
            print(f"[PENDIENTE] {placa}: no reconocida exactamente")

    print("\nNota: una coincidencia de texto no confirma por sí sola")
    print("que la placa pertenezca al vehículo correcto.")

if __name__ == "__main__":
    main()
