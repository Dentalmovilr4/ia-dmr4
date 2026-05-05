require('dotenv').config();

const tls = require('tls');
const fs = require('fs');
const crypto = require('crypto');
const Redis = require('ioredis');
const { fork } = require('child_process');
const os = require('os');
const path = require('path');

// Configuración de Redis
const redis = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1' });

// Configuración de Identidad y Seguridad
const SECRET = process.env.CLUSTER_SECRET;
const HOSTNAME = process.env.HOSTNAME || `nodo-${os.hostname()}`;
const MASTER_HOST = process.env.MASTER_HOST || '127.0.0.1';

let procesosActivos = {};

// ---------------------------------------------------------
// UTILS DE SEGURIDAD
// ---------------------------------------------------------
function firmar(p) {
  return crypto.createHmac('sha256', SECRET).update(JSON.stringify(p)).digest('hex');
}

// ---------------------------------------------------------
// GESTIÓN DE CONEXIÓN TLS (AUTO-RECONNECT)
// ---------------------------------------------------------
let socket;

function conectarAlMaestro() {
  console.log(`📡 Intentando conectar al Orchestrator en ${MASTER_HOST}:5001...`);

  socket = tls.connect({
    host: MASTER_HOST,
    port: 5001,
    key: fs.readFileSync('./certs/client.key'),
    cert: fs.readFileSync('./certs/client.crt'),
    ca: fs.readFileSync('./certs/ca.crt'),
    rejectUnauthorized: true
  });

  socket.on('secureConnect', () => {
    console.log("🔐 Conexión TLS establecida y verificada.");
  });

  socket.on('data', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // VALIDACIÓN DE FIRMA
      if (firmar(msg.payload) !== msg.firma) {
        console.warn("⚠️ Mensaje recibido con firma inválida. Ignorando...");
        return;
      }

      // ACCIÓN SEGÚN EL TIPO
      if (msg.tipo === 'run') {
        console.log(`🚀 Orden recibida: Ejecutar ${msg.payload.name}`);
        await ejecutarTarea(msg.payload);
      }

    } catch (err) {
      // Error en el parseo del JSON
    }
  });

  socket.on('error', (err) => {
    console.error(`❌ Error en socket: ${err.message}`);
  });

  socket.on('close', () => {
    console.log("🔌 Conexión cerrada. Reintentando en 5 segundos...");
    setTimeout(conectarAlMaestro, 5000);
  });
}

// ---------------------------------------------------------
// LÓGICA DE EJECUCIÓN DE TRABAJOS (WORKERS)
// ---------------------------------------------------------
async function ejecutarTarea(repo) {
  // Evitar duplicados locales
  if (procesosActivos[repo.name]) {
    console.log(`ℹ️ ${repo.name} ya está corriendo en este nodo.`);
    return;
  }

  // Validar si el archivo existe
  const rutaAbsoluta = path.resolve(__dirname, repo.path);
  if (!fs.existsSync(rutaAbsoluta)) {
    console.error(`❌ No existe el archivo: ${rutaAbsoluta}`);
    return;
  }

  try {
    const child = fork(rutaAbsoluta);
    
    procesosActivos[repo.name] = child;

    // Registrar en Redis que este nodo es el dueño
    await redis.set(`proc:${repo.name}`, HOSTNAME, 'EX', 60);

    console.log(`✅ [${repo.name}] en ejecución (PID: ${child.pid})`);

    child.on('exit', async (code) => {
      console.log(`💀 [${repo.name}] terminó (Código: ${code})`);
      delete procesosActivos[repo.name];
      // Limpiar en Redis para que el orquestador lo reasigne si es necesario
      await redis.del(`proc:${repo.name}`);
    });

    child.on('error', (err) => {
      console.error(`💥 Fallo en el proceso hijo ${repo.name}:`, err.message);
    });

  } catch (error) {
    console.error(`❌ Fallo crítico al lanzar ${repo.name}:`, error.message);
  }
}

// ---------------------------------------------------------
// HEARTBEAT (REPORTAR CARGA AL MAESTRO)
// ---------------------------------------------------------
setInterval(async () => {
  if (!socket || !socket.writable) return;

  const payload = {
    nombre: HOSTNAME,
    carga: os.loadavg()[0] || Object.keys(procesosActivos).length,
    memoriaLibre: os.freemem(),
    procesosCount: Object.keys(procesosActivos).length
  };

  socket.write(JSON.stringify({
    tipo: 'status',
    payload,
    firma: firmar(payload)
  }));

  // Renovamos el TTL de los procesos que tenemos activos en Redis
  for (const nombre in procesosActivos) {
    await redis.expire(`proc:${nombre}`, 60);
  }

}, 5000);

// ---------------------------------------------------------
// INICIO
// ---------------------------------------------------------
console.log(`🤖 DMR4 WORKER NODE - ID: ${HOSTNAME}`);
conectarAlMaestro();
