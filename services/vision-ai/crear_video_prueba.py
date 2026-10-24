
import cv2
from pathlib import Path

VIDEO_ORIGINAL = Path(
    "services/vision-ai/media/zona2_coliseo_tramo1.mp4"
)

VIDEO_PRUEBA = Path(
    "services/vision-ai/media/prueba_ocr_30s.mp4"
)

# Fragmentos del video original: (inicio en segundos, duración)
FRAGMENTOS = [
    (0, 8),
    (4 * 60 + 41, 8),
    (19 * 60 + 26, 8),
    (22 * 60 + 45, 6),
]

def main():
    cap = cv2.VideoCapture(str(VIDEO_ORIGINAL))

    if not cap.isOpened():
        print(f"ERROR: No se pudo abrir {VIDEO_ORIGINAL}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    ancho = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    alto = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if fps <= 0 or ancho <= 0 or alto <= 0:
        print("ERROR: No se pudieron leer los datos del video.")
        cap.release()
        return

    VIDEO_PRUEBA.parent.mkdir(parents=True, exist_ok=True)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    salida = cv2.VideoWriter(
        str(VIDEO_PRUEBA), fourcc, fps, (ancho, alto)
    )

    if not salida.isOpened():
        print("ERROR: No se pudo crear el video de prueba.")
        cap.release()
        return

    total = 0

    try:
        for inicio, duracion in FRAGMENTOS:
            print(
                f"Extrayendo desde {inicio:.0f}s "
                f"durante {duracion}s..."
            )

            cap.set(cv2.CAP_PROP_POS_MSEC, inicio * 1000)
            limite = int(duracion * fps)
            escritos = 0

            while escritos < limite:
                ok, frame = cap.read()

                if not ok:
                    print("Aviso: se alcanzó el final del video.")
                    break

                salida.write(frame)
                escritos += 1

            total += escritos

    finally:
        cap.release()
        salida.release()

    print(f"\nFotogramas escritos: {total}")
    print(f"Duración aproximada: {total / fps:.1f} segundos")
    print(f"Video creado: {VIDEO_PRUEBA}")

if __name__ == "__main__":
    main()
