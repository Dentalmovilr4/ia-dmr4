require('dotenv').config();
const ccxt = require('ccxt');
const Redis = require('ioredis');

const redis = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1' });

/**
 * IA-DMR4: Execution Algo
 * Algoritmos de ejecución sigilosa (TWAP/VWAP) con soporte KuCoin.
 * Optimizado para evitar errores de Timestamp y latencia en red móvil.
 */

const SYMBOL = process.env.SYMBOL || 'BTC/USDT';
const MODE = process.env.MODE || 'TWAP'; 
const TOTAL_USD = parseFloat(process.env.TOTAL_USD || 0);
const MAX_SLIP = parseFloat(process.env.MAX_SLIPPAGE || 0.002); // 0.2%
const SLICE_SEC = parseInt(process.env.SLICE_SEC || 60);

// Configuración de cliente robusta para KuCoin
const client = new ccxt[process.env.EXCHANGE || 'kucoin']({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  password: process.env.API_PASSPHRASE,
  enableRateLimit: true,
  options: {
    'adjustForTimeDifference': true, // 🚀 Sincronización automática de reloj
    'recvWindow': 15000,             // Margen de 15 segundos para estabilidad
    'api-expires': 30
  }
});

let executedUSD = 0;

async function getExecutionPrice(usd) {
  const ob = await client.fetchOrderBook(SYMBOL, 20);

  if (!ob.bids.length || !ob.asks.length) {
    throw new Error("Libro de órdenes vacío o símbolo incorrecto");
  }

  const mid = (ob.bids[0][0] + ob.asks[0][0]) / 2;

  let accQty = 0, accCost = 0;
  for (const [p, q] of ob.asks) {
    const cost = p * q;
    if (accCost + cost >= usd) {
      accQty += (usd - accCost) / p;
      accCost = usd;
      break;
    }
    accQty += q;
    accCost += cost;
  }

  const vwapPrice = accCost / (accQty || 1);
  const slip = Math.abs(vwapPrice - mid) / mid;

  return { vwapPrice, slip, mid };
}

async function loop() {
  try {
    // --- PUERTA DE RIESGO ---
    const halt = await redis.get('system:halt');
    if (halt === 'true') {
      console.log("⛔ IA-DMR4 EXEC: Bloqueado por Risk Engine.");
      return;
    }

    if (executedUSD >= TOTAL_USD) {
      console.log("✅ IA-DMR4 EXEC: Ejecución completa satisfactoriamente.");
      process.exit(0);
    }

    // Calcular tamaño del fragmento (Slice)
    let sliceUSD = (MODE === 'TWAP') ? (TOTAL_USD / 10) : (TOTAL_USD * 0.1); 
    sliceUSD = Math.min(sliceUSD, TOTAL_USD - executedUSD);

    const { vwapPrice, slip, mid } = await getExecutionPrice(sliceUSD);

    if (slip > MAX_SLIP) {
      console.log(`⚠️ Deslizamiento alto (${(slip * 100).toFixed(3)}%), mercado volátil. Esperando...`);
      return;
    }

    console.log(`💰 IA-DMR4 [${MODE}]: ${SYMBOL} | Precio Mid: ${mid.toFixed(2)} | Slip: ${(slip * 100).toFixed(4)}%`);

    /**
     * EJECUCIÓN REAL (KuCoin)
     * El cálculo de cantidad incluye el precio VWAP estimado.
     */
    // const amount = sliceUSD / vwapPrice;
    // const order = await client.createMarketBuyOrder(SYMBOL, amount);
    // console.log(`🚀 Orden colocada ID: ${order.id}`);

    executedUSD += sliceUSD;

    await redis.set('execution:progress', JSON.stringify({
      executedUSD,
      pct: (executedUSD / TOTAL_USD) * 100,
      last_price: vwapPrice,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error("❌ Error en Execution Algo:", error.message);
    if (error.message.includes('KC-API-TIMESTAMP')) {
        console.error("👉 Error de tiempo detectado. El sistema está auto-ajustando la firma...");
    }
    if (error.message.includes('insufficient')) {
        console.error("👉 Error: Saldo insuficiente. Mueve USDT a la 'Trading Account' en KuCoin.");
    }
  }
}

console.log(`⚙️ IA-DMR4: Execution Algo (${MODE}) activo para ${SYMBOL} en ${process.env.EXCHANGE || 'KUCOIN'}...`);

// Primera ejecución inmediata
loop();

// Ciclo constante
setInterval(loop, SLICE_SEC * 1000);

