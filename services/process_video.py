import cv2
import requests
import time

# Configuración del servidor Node.js
API_URL = "http://localhost:3000/api"
SPOT_ID = "COL-01"  # Identificador de la celda

# Archivo de video a procesar
VIDEO_PATH = "video_coliseo.mp4"

def notificar_ocupacion(spot_id, placa):
    try:
        response = requests.post(f"{API_URL}/spots/occupy", json={
            "spot_id": spot_id,
            "license_plate": placa
        })
        print("🟢 Evento enviado -> Ocupado:", response.json())
    except Exception as e:
        print("❌ Error al conectar con Backend:", e)

def notificar_liberacion(spot_id):
    try:
        response = requests.post(f"{API_URL}/spots/release", json={
            "spot_id": spot_id
        })
        print("🔴 Evento enviado -> Liberado:", response.json())
    except Exception as e:
        print("❌ Error al conectar con Backend:", e)

# Apertura de Video
cap = cv2.VideoCapture(VIDEO_PATH)

print("🎥 Iniciando procesamiento del video...")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Muestra la ventana del video
    cv2.imshow('Simulacion Camara Zona Coliseo', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()