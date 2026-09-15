import cv2
import requests
import os
import time

API_URL = "http://localhost:3000/api"
SPOT_ID = "COL-01"
VIDEO_PATH = "video_coliseo.mp4"

def enviar_estado(estado, placa="ABC-123"):
    try:
        if estado == 'occupied':
            url = f"{API_URL}/spots/occupy"
            res = requests.post(url, json={"spot_id": SPOT_ID, "license_plate": placa})
            print(f"🟢 [VISION AI] Celda {SPOT_ID} -> OCUPADA")
        else:
            url = f"{API_URL}/spots/release"
            res = requests.post(url, json={"spot_id": SPOT_ID})
            print(f"⚪ [VISION AI] Celda {SPOT_ID} -> LIBRE")
    except Exception as e:
        print("❌ Error de conexión con Backend:", e)

# Verificar si el video existe
if os.path.exists(VIDEO_PATH):
    print(f"🎬 Cargando video: {VIDEO_PATH}")
    cap = cv2.VideoCapture(VIDEO_PATH)
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        
        cv2.imshow("Camara Zona Coliseo", frame)
        if cv2.waitKey(30) & 0xFF == ord('q'):
            break
    cap.release()
    cv2.destroyAllWindows()

else:
    print(f"⚠️ No se encontró '{VIDEO_PATH}'. Entrando en modo de pruebas manuales.")
    print("---------------------------------------------------------------------")
    print(" Presiona 'o' en la terminal para OCUPAR la celda")
    print(" Presiona 'l' en la terminal para LIBERAR la celda")
    print(" Presiona 'q' para salir")
    print("---------------------------------------------------------------------")

    while True:
        comando = input("Comando (o/l/q): ").strip().lower()
        if comando == 'o':
            enviar_estado('occupied', 'MAN-456')
        elif comando == 'l':
            enviar_estado('available')
        elif comando == 'q':
            print("Saliendo del simulador...")
            break