require('dotenv').config();
const Redis = require('ioredis');

// Configuración de Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
});

const REGION = process.env.REGION || 'secondary'; // 'primary' o 'secondary'
let activo = REGION === 'primary';

/**
 * Publica la señal de vida de esta región en Redis.
 */
async function enviarHeartbeat() {
  try {
    // Marcamos que esta región está viva con un tiempo de expiración de 10s
    await redis.set(`region:${REGION}`, Date.now(), 'EX', 10);
  } catch (err) {
    console.error(`❌ Error en heartbeat de ${REGION}:`, err.message);
  }
}

/**
 * Verifica el estado de la región compañera para decidir si tomar el mando.
 */
async function verificarEstadoGlobal() {
  try {
    const peerRegion = REGION === 'primary' ? 'secondary' : 'primary';
    const peerLastSeen = await redis.get(`region:${peerRegion}`);

    // LÓGICA DE ALTA DISPONIBILIDAD
    if (REGION === 'secondary') {
      if (!peerLastSeen) {
        // Si soy secundaria y la primaria desapareció, tomo el control
        if (!activo) {
          console.log("⚠️ Región Primaria no detectada. Asumiendo rol ACTIVO.");
          activo = true;
        }
      } else {
        // Si la primaria regresó, vuelvo a modo espera (pasivo)
        if (activo) {
          console.log("✅ Región Primaria detectada. Volviendo a modo PASIVO.");
          activo = false;
        }
      }
    } else {
      // Si soy primaria, siempre intento ser activo a menos que haya un error crítico
      activo = true;
    }

    // Publicamos en Redis quién es el líder actual para el monitor
    if (activo) {
      await redis.set('cluster:leader', REGION, 'EX', 5);
    }

  } catch (err) {
    console.error("❌ Error verificando Peer:", err.message);
  }
}

/**
 * Exporta el estado actual para que el Orchestrator sepa si debe trabajar.
 */
function soyActivo() {
  return activo;
}

// ---------------------------------------------------------
// LOOP DE CONTROL (Cada 3 segundos)
// ---------------------------------------------------------
setInterval(async () => {
  await enviarHeartbeat();
  await verificarEstadoGlobal();
}, 3000);

// Ejecución inicial inmediata
(async () => {
  await enviarHeartbeat();
  await verificarEstadoGlobal();
  console.log(`🌐 Region Manager [${REGION}] - Estado Inicial: ${activo ? 'ACTIVO' : 'PASIVO'}`);
})();

module.exports = {
  soyActivo
};
