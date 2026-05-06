require('dotenv').config();
const Redis = require('ioredis');
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

// --- CONFIGURACIÓN DE RIESGO ---
const MAX_DD = parseFloat(process.env.MAX_DRAWDOWN || 0.15); // 15% Max Drawdown
const DAILY_LIMIT = parseFloat(process.env.DAILY_LOSS_LIMIT || 0.05); // 5% pérdida diaria
const VAR_CONF = parseFloat(process.env.VAR_CONFIDENCE || 0.95);
const KILL = process.env.KILL_SWITCH === 'true';

/**
 * IA-DMR4: Risk Engine
 * Guardián de capital con protocolos de parada de emergencia.
 */

function calculateDrawdown(pnl) {
  let peak = pnl[0] || 0;
  let maxDD = 0;
  for (let v of pnl) {
    if (v > peak) peak = v;
    const dd = (peak - v) / (peak || 1);
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function calculateVaR(pnl) {
  if (pnl.length < 10) return 0;
  const returns = [];
  for (let i = 1; i < pnl.length; i++) {
    returns.push((pnl[i] - pnl[i-1]) / (Math.abs(pnl[i-1]) || 1));
  }
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - VAR_CONF) * sorted.length);
  return Math.abs(sorted[idx] || 0);
}

async function killSwitch(reason) {
  console.log(`🚨 IA-DMR4: KILL SWITCH ACTIVADO -> ${reason}`);
  await redis.set('system:halt', 'true');
  await redis.set('system:halt:reason', reason);
}

async function loop() {
  try {
    const pnl = JSON.parse(await redis.get('pnl:history') || '[]');
    const positions = JSON.parse(await redis.get('positions') || '[]');

    if (pnl.length < 2) return;

    const dd = calculateDrawdown(pnl);
    const dailyLoss = pnl[pnl.length - 1] - pnl[0];
    const var95 = calculateVaR(pnl);

    console.log(`\n🛡️ IA-DMR4 RISK: DD: ${(dd * 100).toFixed(2)}% | VaR: ${(var95 * 100).toFixed(2)}%`);

    // REGLAS DE PROTECCIÓN
    if (KILL) {
      if (dd > MAX_DD) return await killSwitch('MAX DRAWDOWN EXCEDIDO');
      if (dailyLoss < -(DAILY_LIMIT * 1000)) return await killSwitch('LIMITE DE PERDIDA DIARIA'); // Ajustar según capital base
      if (var95 > 0.10) return await killSwitch('VAR EXTREMO DETECTADO');
    }

    // Si todo está bien, asegurar que el sistema pueda operar
    const currentHalt = await redis.get('system:halt');
    if (currentHalt === 'true' && dd < (MAX_DD * 0.8)) {
        // Opcional: auto-reinicio si el riesgo baja
        // await redis.set('system:halt', 'false');
    }

  } catch (error) {
    console.error("❌ Error en Risk Engine:", error.message);
  }
}

console.log("🛡️ IA-DMR4: Risk Engine activo y protegiendo el capital...");
setInterval(loop, 10000);
