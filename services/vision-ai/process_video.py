import cv2
import requests
import time

API_URL = "http://localhost:3000/api/ai"

# Configuración apuntando a la Zona Coliseo 2
VIDEOS_CONFIG = [
    {
        "path": "services/vision-ai/media/zona2_coliseo_tramo1.mp4",
        "zone_name": "Zona Coliseo 2 - Cra 24",
        "spots": [
            {"spot_number": 1, "area": [(100, 200), (200, 200), (200, 350), (100, 350)]},
        ]
    }
]

def send_event(zone_name, spot_number, action, plate="XYZ987"):
    payload = {
        "zone_name": zone_name,
        "spot_number": spot_number,
        "license_plate": plate,
        "action": action
    }
    try:
        res = requests.post(f"{API_URL}/event", json=payload)
        print(f"📡 Backend [{action} Celda {spot_number}]: Status {res.status_code} ->", res.json())
    except Exception as e:
        print(f"⚠️ Error de conexión con el backend: {e}")

def process_single_video(config):
    video_path = config["path"]
    zone_name = config["zone_name"]

    print(f"\n🎥 Analizando tramo de la {zone_name} ({video_path})...")
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"⚠️ No se pudo abrir {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = 0
    occupied = False

    # Eventos programados por tiempo (en segundos del video)
    # Ejemplo: Se ocupa al segundo 5 y se libera al segundo 25
    TIME_OCCUPY = 5
    TIME_RELEASE = 25

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        seconds_elapsed = frame_count / fps

        # Imprimir log cada 2 segundos simulados
        if frame_count % (int(fps) * 2) == 0:
            print(f"⏱️ Tiempo del video: {int(seconds_elapsed)}s | Fotograma #{frame_count}")

        # Detectar evento de ocupación
        if not occupied and seconds_elapsed >= TIME_OCCUPY:
            print(f"\n🚗 [DETECCIÓN IA] Vehículo ingresando a la Celda 1...")
            send_event(zone_name, spot_number=1, action="OCCUPY", plate="COL-456")
            occupied = True

        # Detectar evento de liberación
        if occupied and seconds_elapsed >= TIME_RELEASE:
            print(f"\n🚙 [DETECCIÓN IA] Vehículo saliendo de la Celda 1...")
            send_event(zone_name, spot_number=1, action="RELEASE")
            occupied = False
            # Detenemos la prueba tras completar el ciclo de prueba
            break

    cap.release()
    print("\n✅ Análisis del tramo finalizado.")

if __name__ == "__main__":
    process_single_video(VIDEOS_CONFIG[0])