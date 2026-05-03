import requests
import pandas as pd
import time
import os
from datetime import datetime

TOKEN_ADDRESS = "3CThGZU6DA6CdRMeYqnW12rtpudL9TgQPFT7qqu4NJ84"
CSV_PATH = "data/dmr4_market_data.csv"

# ----------------------
# CONFIG
# ----------------------

INTERVALO = 300  # 5 minutos (más útil que 1h)
TIMEOUT = 10

# ----------------------
# UTILIDADES
# ----------------------

def asegurar_csv():
    os.makedirs("data", exist_ok=True)
    if not os.path.exists(CSV_PATH):
        df = pd.DataFrame(columns=[
            "timestamp", "precio", "volumen_24h", "liquidez", "buys_5m"
        ])
        df.to_csv(CSV_PATH, index=False)

def fetch_data():
    url = f"https://api.dexscreener.com/latest/dex/pairs/solana/{TOKEN_ADDRESS}"
    response = requests.get(url, timeout=TIMEOUT)

    if response.status_code != 200:
        raise Exception(f"HTTP {response.status_code}")

    data = response.json()

    if "pairs" not in data or not data["pairs"]:
        raise Exception("Sin datos de pares")

    return data["pairs"][0]

# ----------------------
# ANÁLISIS INTELIGENTE
# ----------------------

def evaluar_datos(reg):
    if reg["liquidez"] < 1000:
        return "MUERTO"
    if reg["volumen_24h"] < 500:
        return "BAJO"
    if reg["buys_5m"] > 20:
        return "ALTA_DEMANDA"
    return "NORMAL"

# ----------------------
# PROCESO PRINCIPAL
# ----------------------

def capturar_datos():
    try:
        pair = fetch_data()

        registro = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "precio": float(pair.get('priceUsd', 0)),
            "volumen_24h": float(pair.get('volume', {}).get('h24', 0)),
            "liquidez": float(pair.get('liquidity', {}).get('usd', 0)),
            "buys_5m": int(pair.get('txns', {}).get('m5', {}).get('buys', 0))
        }

        estado = evaluar_datos(registro)

        # Guardar
        df = pd.DataFrame([registro])
        df.to_csv(CSV_PATH, mode='a', header=False, index=False)

        print(f"[{datetime.now().time()}] ✅ Datos guardados | Estado: {estado}")

        # 🔥 DECISIÓN
        if estado == "MUERTO":
            print("🛑 ALERTA: Token sin liquidez")
        elif estado == "ALTA_DEMANDA":
            print("🚀 POSIBLE PUMP DETECTADO")

    except Exception as e:
        print(f"❌ Error: {e}")

# ----------------------
# LOOP RESILIENTE
# ----------------------

def run():
    asegurar_csv()

    while True:
        capturar_datos()

        # 🔁 Ajuste dinámico (decisión)
        tiempo = INTERVALO
        try:
            tiempo = INTERVALO
        except:
            tiempo = 600

        time.sleep(tiempo)

# ----------------------

if __name__ == "__main__":
    run()