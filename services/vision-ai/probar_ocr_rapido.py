import cv2
import time
from pathlib import Path
from rapidocr_onnxruntime import RapidOCR

VIDEO = Path("services/vision-ai/media/prueba_placas.mp4")

# Segundos donde ya reconocimos las placas
PRUEBAS = [
    (8.5, "GTL664"),
    (24.5, "GET298"),
]

def normalizar(texto):
    return "".join(c for c in texto.upper() if c.isalnum())

def main():
    if not VIDEO.exists():
        print(f"ERROR: No se encuentra el video: {VIDEO}")
        return

    cap = cv2.VideoCapture(str(VIDEO))

    if not cap.isOpened():
        print("ERROR: No se pudo abrir el video.")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    print("Cargando RapidOCR...")
    inicio = time.time()
    ocr = RapidOCR()
    print(f"Motor preparado en {time.time() - inicio:.1f} segundos.")

    try:
        for segundo, esperada in PRUEBAS:
            cap.set(cv2.CAP_PROP_POS_MSEC, segundo * 1000)
            ok, frame = cap.read()

            if not ok:
                print(f"No se pudo leer el segundo {segundo}.")
                continue

            # Usar el fotograma completo reducido para esta primera comparación
            alto, ancho = frame.shape[:2]
            escala = min(1.0, 960 / ancho)

            if escala < 1.0:
                frame = cv2.resize(
                    frame,
                    (int(ancho * escala), int(alto * escala))
                )

            print(f"\nPlaca esperada: {esperada} | segundo {segundo}")
            inicio_ocr = time.time()
            resultado, _ = ocr(frame)
            print(f"Tiempo OCR: {time.time() - inicio_ocr:.2f} segundos")

            encontrados = []

            if resultado:
                for elemento in resultado:
                    texto = str(elemento[1])
                    confianza = float(elemento[2])
                    limpio = normalizar(texto)

                    if limpio:
                        encontrados.append(limpio)
                        print(f"Texto: {texto} | confianza: {confianza:.2f}")

            if esperada in encontrados:
                print(f"RESULTADO: coincidencia exacta con {esperada}")
            elif any(esperada in texto or texto in esperada
                     for texto in encontrados if len(texto) >= 4):
                print("RESULTADO: posible coincidencia; revisar lectura.")
            else:
                print("RESULTADO: placa no reconocida exactamente.")

    finally:
        cap.release()

    print("\nPrueba RapidOCR finalizada.")

if __name__ == "__main__":
    main()
