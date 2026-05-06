require('dotenv').config();
const ccxt = require('ccxt');
const Redis = require('ioredis');

const redis = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1' });

/**
 * IA-DMR4: Fund System
 * Gestor de capital y auditoría de fondos para KuCoin/Binance.
 * Optimizado para evitar errores de Timestamp en entornos móviles.
 */

const client = new ccxt[process.env.EXCHANGE || 'kucoin']({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  password: process.env.API_PASSPHRASE,
  enableRateLimit: true,
  options: {
    'adjustForTimeDifference': true, // 🚀 Sincronización automática con el servidor
    'recvWindow': 15000,             // Margen de 15 segundos para evitar el error 400002
    'api-expires': 30
  }
});

async function updateBalances() {
  try {
    const exchangeName = (process.env.EXCHANGE || 'kucoin').toUpperCase();
    console.log(`\n💰 IA-DMR4 FUNDS: Sincronizando con ${exchangeName}...`);

    // Forzamos la actualización de saldos
    const balance = await client.fetchBalance();

    // Verificamos USDT disponible
    const totalEquity = (balance.total && balance.total['USDT']) ? balance.total['USDT'] : 0;

    // Guardar para el Risk Engine y Dashboard
    await redis.set('funds:total_equity', totalEquity);

    // Obtener la estrategia del Optimizer
    const weightsData = await redis.get('portfolio:weights');
    const weights = weightsData ? JSON.parse(weightsData) : [];

    let allocations = {};

    weights.forEach(p => {
      const assetSymbol = p.asset.split('/')[0];
      allocations[p.asset] = {
        weight: p.weight,
        allocatedUSD: totalEquity * p.weight,
        currentBalance: (balance.total && balance.total[assetSymbol]) ? balance.total[assetSymbol] : 0
      };
    });

    await redis.set('funds:allocations', JSON.stringify(allocations));

    console.log(`💵 Equity Total: $${totalEquity.toFixed(2)} USDT`);
    
    if (weights.length === 0) {
      console.log("⏳ Esperando pesos del Optimizer (Revisa si Alpha-Lab está corriendo)...");
    } else {
      weights.forEach(p => {
        console.log(`🔹 ${p.asset}: Asignado $${(totalEquity * p.weight).toFixed(2)}`);
      });
    }

  } catch (error) {
    console.error("❌ Error en Fund System:", error.message);
    
    if (error.message.includes('KC-API-TIMESTAMP')) {
        console.error("👉 Reintentando sincronización de tiempo automática...");
    }
    if (error.message.includes('authentication')) {
        console.error("👉 Verifica API_KEY, SECRET y PASSPHRASE en el .env");
    }
  }
}

// Ciclo de auditoría cada 30 segundos
console.log("💰 IA-DMR4: Fund System activo y sincronizado con el reloj de KuCoin.");
setInterval(updateBalances, 30000);

// Ejecución inmediata
updateBalances();

