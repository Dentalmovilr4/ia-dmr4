require('dotenv').config();
const ccxt = require('ccxt');
const Redis = require('ioredis');

const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

/**
 * IA-DMR4: Fund System
 * Gestor de capital y auditoría de fondos para KuCoin/Binance.
 */

// Configuración del cliente con soporte para API_PASSPHRASE (KuCoin)
const client = new ccxt[process.env.EXCHANGE || 'binance']({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  password: process.env.API_PASSPHRASE, // Vital para KuCoin
  enableRateLimit: true
});

async function updateBalances() {
  try {
    console.log("\n💰 IA-DMR4 FUNDS: Sincronizando con " + process.env.EXCHANGE.toUpperCase() + "...");
    
    // Forzamos la actualización de saldos
    const balance = await client.fetchBalance();
    
    // Verificamos USDT disponible (Base de la IA-DMR4)
    const totalEquity = (balance.total && balance.total['USDT']) ? balance.total['USDT'] : 0;
    
    // Guardar para el Risk Engine y Dashboard
    await redis.set('funds:total_equity', totalEquity);
    
    // Obtener la estrategia del Optimizer
    const weightsData = await redis.get('portfolio:weights');
    const weights = weightsData ? JSON.parse(weightsData) : [];
    
    let allocations = {};
    
    weights.forEach(p => {
      // Separamos el activo (ej: de 'BTC/USDT' sacamos 'BTC')
      const assetSymbol = p.asset.split('/')[0];
      
      allocations[p.asset] = {
        weight: p.weight,
        allocatedUSD: totalEquity * p.weight,
        // Evitamos errores si el balance del activo está vacío
        currentBalance: (balance.total && balance.total[assetSymbol]) ? balance.total[assetSymbol] : 0
      };
    });

    await redis.set('funds:allocations', JSON.stringify(allocations));
    
    console.log(`💵 Equity Total: $${totalEquity.toFixed(2)} USDT`);
    if (weights.length === 0) console.log("⏳ Esperando pesos del Optimizer...");
    
    weights.forEach(p => {
      console.log(`🔹 ${p.asset}: Asignado $${(totalEquity * p.weight).toFixed(2)}`);
    });

  } catch (error) {
    console.error("❌ Error de Conexión/Sintaxis en Fund System:", error.message);
    // Si el error es de autenticación, lo notificamos claro
    if (error.message.includes('authentication')) {
        console.error("👉 Revisa tu API_KEY, SECRET y PASSPHRASE en el .env");
    }
  }
}

// Ciclo de auditoría: 30 segundos es ideal para no saturar la API de KuCoin
console.log("💰 IA-DMR4: Fund System activo. Auditando billeteras cada 30s...");
setInterval(updateBalances, 30000);

// Ejecución inmediata al arrancar
updateBalances();

