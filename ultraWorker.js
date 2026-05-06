require('dotenv').config();
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });
const WORKER_ID = `worker-${uuidv4().split('-')[0]}`;

/**
 * IA-DMR4: Ultra Worker
 * Motor de ejecución con registro de salud dinámico.
 */

async function startWorker() {
  console.log(`🚀 IA-DMR4: ${WORKER_ID} iniciando en El Copey...`);

  // Registro inicial y latido constante (Heartbeat)
  setInterval(async () => {
    try {
      await redis.hset('cluster:workers', WORKER_ID, Date.now());
      
      // Verificar si el sistema global está en HALT (Parada de emergencia)
      const halt = await redis.get('system:halt');
      if (halt === 'true') {
        console.log(`⚠️ ${WORKER_ID}: Sistema en PAUSA por Risk Engine.`);
      }

    } catch (error) {
      console.error(`❌ Error de conexión en ${WORKER_ID}:`, error.message);
    }
  }, 5000); // Latido cada 5 segundos

  // Simulación de carga de tareas desde Redis
  console.log(`✅ ${WORKER_ID} listo para procesar señales.`);
}

// Limpieza al cerrar para no dejar basura en Redis
const gracefulShutdown = async () => {
  console.log(`\n🛑 Cerrando ${WORKER_ID} de forma segura...`);
  await redis.hdel('cluster:workers', WORKER_ID);
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startWorker();
