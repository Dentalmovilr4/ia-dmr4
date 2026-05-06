require('dotenv').config();
const Redis = require('ioredis');
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

const WORKER_TIMEOUT = 30000; // 30 segundos de margen

/**
 * IA-DMR4: Control Plane
 * Orquestador central de la flota distribuida.
 */

async function monitorCluster() {
  console.log("🛰️ IA-DMR4: Control Plane activo y monitoreando...");

  setInterval(async () => {
    try {
      const workers = await redis.hgetall('cluster:workers');
      const now = Date.now();

      for (const [workerId, lastSeen] of Object.entries(workers)) {
        if (now - parseInt(lastSeen) > WORKER_TIMEOUT) {
          console.log(`⚠️ Alerta: Worker ${workerId} fuera de línea. Limpiando...`);
          await redis.hdel('cluster:workers', workerId);
          // Aquí el orquestador podría disparar una señal de reinicio si fuera necesario
        }
      }

      // Estado global del sistema para los otros módulos
      const systemStatus = {
        activeWorkers: Object.keys(workers).length,
        lastCheck: now,
        status: 'HEALTHY'
      };

      await redis.set('system:status', JSON.stringify(systemStatus));

    } catch (error) {
      console.error("❌ Error en Control Plane:", error.message);
    }
  }, 10000); // Revisión cada 10 segundos
}

// Manejo de señales de cierre
process.on('SIGINT', async () => {
  console.log("\n🛑 Apagando Control Plane de forma segura...");
  process.exit(0);
});

monitorCluster();
