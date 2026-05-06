require('dotenv').config();
const Redis = require('ioredis');
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

/**
 * IA-DMR4: Consistency Guard
 * Sistema de semáforos y bloqueos globales para procesos críticos.
 */

const LOCK_TIMEOUT = 10000; // 10 segundos máximo para un bloqueo

async function adquirirLockGlobal(resource) {
  const lockKey = `lock:${resource}`;
  const lockValue = Date.now() + LOCK_TIMEOUT;

  // NX: Solo establece si no existe | PX: Expira en milisegundos
  const acquired = await redis.set(lockKey, lockValue, 'NX', 'PX', LOCK_TIMEOUT);

  if (acquired) {
    console.log(`🔒 Guard: Bloqueo adquirido para [${resource}]`);
    return true;
  }
  
  return false;
}

async function liberarLockGlobal(resource) {
  const lockKey = `lock:${resource}`;
  await redis.del(lockKey);
  console.log(`🔓 Guard: Bloqueo liberado para [${resource}]`);
}

// Ejemplo de uso para pruebas (puedes borrarlo al integrar)
async function testGuard() {
  const recurso = "orden:ejecucion:btc";
  
  if (await adquirirLockGlobal(recurso)) {
    // Simular trabajo
    setTimeout(async () => {
      await liberarLockGlobal(recurso);
    }, 2000);
  } else {
    console.log("⚠️ Guard: Recurso ocupado, reintentando en breve...");
  }
}

module.exports = { adquirirLockGlobal, liberarLockGlobal };

// Solo ejecuta el test si se corre directamente
if (require.main === module) {
    testGuard();
}
