require('dotenv').config();

const Redis = require('ioredis');
const { exec } = require('child_process');

// Conexión a la memoria compartida del clúster
const redis = new Redis({ 
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379 
});

// CONFIGURACIÓN DE UMBRALES
const SERVICE = 'worker'; // Nombre del servicio en docker-compose
const MIN_REPLICAS = 1;
const MAX_REPLICAS = 6;

// Umbrales de carga (Basados en Load Average o número de procesos)
const SCALE_UP_THRESHOLD = 1.5;   // Si la carga sube de 1.5, lanzamos refuerzos
const SCALE_DOWN_THRESHOLD = 0.5; // Si baja de 0.5, apagamos nodos innecesarios

/**
 * Ejecuta comandos de sistema de forma asíncrona
 */
function sh(cmd) {
  return new Promise((res) => {
    exec(cmd, (err, stdout) => {
      if (err) {
        // En algunos entornos Docker, exec puede fallar si el comando no existe
        return res('');
      }
      res(stdout || '');
    });
  });
}

/**
 * Obtiene el número real de contenedores corriendo actualmente
 */
async function getReplicas() {
  // Filtramos por el nombre del servicio definido en docker-compose
  const out = await sh(`docker ps --filter "name=${SERVICE}" --filter "status=running" --format "{{.Names}}"`);
  if (!out) return 0;
  return out.trim().split('\n').length;
}

/**
 * Calcula la carga promedio de TODO el clúster usando los datos de Redis
 */
async function getClusterLoad() {
  const keys = await redis.keys('node:*');
  if (!keys.length) return 0;

  let totalCarga = 0;
  let nodosContados = 0;

  for (const k of keys) {
    const rawData = await redis.get(k);
    if (rawData) {
      const data = JSON.parse(rawData);
      totalCarga += data.carga || 0;
      nodosContados++;
    }
  }

  return nodosContados > 0 ? totalCarga / nodosContados : 0;
}

/**
 * Ordena a Docker Compose ajustar el número de réplicas
 */
async function ejecutarEscalado(n) {
  console.log(`🚀 [AUTOSCALER] Ajustando flota de ${SERVICE} a ${n} unidades...`);
  // Usamos el comando scale para no tumbar todo el clúster, solo ajustar
  await sh(`docker compose up -d --scale ${SERVICE}=${n}`);
}

/**
 * Bucle de control principal
 */
async function monitorLoop() {
  try {
    const loadPromedio = await getClusterLoad();
    const currentReplicas = await getReplicas();

    console.log(`📊 [STATS] Carga Promedio: ${loadPromedio.toFixed(2)} | Réplicas Activas: ${currentReplicas}`);

    // 🔼 Lógica de Escalado (Up)
    if (loadPromedio > SCALE_UP_THRESHOLD && currentReplicas < MAX_REPLICAS) {
      console.log("🔥 Carga alta detectada!");
      await ejecutarEscalado(currentReplicas + 1);
      return;
    }

    // 🔽 Lógica de Reducción (Down)
    if (loadPromedio < SCALE_DOWN_THRESHOLD && currentReplicas > MIN_REPLICAS) {
      console.log("🧊 El clúster está muy relajado. Reduciendo costos...");
      await ejecutarEscalado(currentReplicas - 1);
      return;
    }

  } catch (err) {
    console.error("❌ Error en el loop de autoscaling:", err.message);
  }
}

// ---------------------------------------------------------
// INICIO DEL MONITOR (Cada 8 segundos para evitar "flapping")
// ---------------------------------------------------------
console.log(`⚖️  Autoscaler DMR4 Iniciado (Límites: ${MIN_REPLICAS}-${MAX_REPLICAS})`);
setInterval(monitorLoop, 8000);
