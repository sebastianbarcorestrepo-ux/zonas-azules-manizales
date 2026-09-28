import sys
from process_video import process_single_video, VIDEOS_CONFIG

def main():
    print("==========================================")
    print("🚀 INICIANDO SERVICIO VISION-AI MANIZALES")
    print("==========================================")
    
    print("\n[+] Videos/Tramos configurados:")
    for idx, config in enumerate(VIDEOS_CONFIG, 1):
        print(f"  {idx}. {config['zone_name']} -> {config['path']}")

    print("\n🎥 Procesando primer tramo (Zona Coliseo 1 - Tramo 1)...")
    process_single_video(VIDEOS_CONFIG[0])

if __name__ == "__main__":
    main()