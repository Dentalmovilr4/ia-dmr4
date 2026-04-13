import requests
import pandas as pd
import time
from datetime import datetime

# Dirección de tu token DMR4 en Solana
TOKEN_ADDRESS = "3CThGZU6DA6CdRMeYqnW12rtpudL9TgQPFT7qqu4NJ84"

def capturar_datos():
    url = f"https://api.dexscreener.com/latest/dex/pairs/solana/{TOKEN_ADDRESS}"
    try:
        response = requests.get(url).json()
        pair = response['pairs'][0]
        
        nuevo_registro = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "precio": float(pair['priceUsd']),
            "volumen_24h": float(pair['volume']['h24']),
            "liquidez": float(pair['liquidity']['usd']),
            "buys_5m": int(pair['txns']['m5']['buys'])
        }
        
        # Guardar en el CSV de tu repositorio
        df = pd.DataFrame([nuevo_registro])
        df.to_csv('data/dmr4_market_data.csv', mode='a', header=False, index=False)
        print(f"[{datetime.now().time()}] Datos de DMR4 guardados, colega.")
        
    except Exception as e:
        print(f"Error al capturar: {e}")

# Captura cada hora
while True:
    capturar_datos()
    time.sleep(3600) 
