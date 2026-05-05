require('dotenv').config();

const tls = require('tls');
const fs = require('fs');
const crypto = require('crypto');
const Redis = require('ioredis');
// Integración de Gestión de Región
const { soyActivo } = require('./regionManager');

const redis = new Redis({ host: process.env.REDIS_HOST });

const PORT = 5001;
const SECRET = process.env.CLUSTER_SECRET;

// Estado en memoria de los nodos conectados a ESTE orquestador
let nodos = {}; 

// ----------------------
// UTILS
// ----------------------
function firmar(p) {
  return crypto.createHmac('sha256', SECRET).update(JSON.stringify(p)).digest('hex');
}

function now() {
  return Date.now();
}

// ----------------------
// TLS SERVER (Búnker de entrada)
// ----------------------
const server = tls.createServer({
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
  ca: fs.readFileSync('./certs/ca.crt'),
  requestCert: true,
  rejectUnauthorized: true
}, (socket) => {

  const cert = socket.getPeerCertificate();
  const id = cert && cert.subject && cert.subject.CN ? cert.subject.CN : `node-${Math.random()}`;

  // Registro inicial del nodo
  nodos[id] = { socket, carga: 0, lastSeen: now() };

  socket.on('data', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // Verificación de integridad HMAC
      if (firmar(msg.payload) !== msg.firma) return;

      if (msg.tipo === 'status') {
        nodos[id].carga = msg.payload.carga;
        nodos[id].lastSeen = now();
        // Publicar estado en Redis para que otras regiones lo vean
        await redis.set(`node:${id}`, JSON.stringify(msg.payload), 'EX', 15);
      }

    } catch (e) {
      // Error silencioso en JSON malformado
    }
  });

  socket.on('end', () => delete nodos[id]);
  socket.on('error', () => delete nodos[id]);
});

server.listen(PORT, () => {
  console.log(`🛡️ Orchestrator DMR4 activo en puerto ${PORT}`);
});

// ----------------------
// LOCK DISTRIBUIDO (Evita colisiones)
// ----------------------
async function lock(key) {
  const ok = await redis.set(key, '1', 'NX', 'EX', 10);
  return ok === 'OK';
}

// ----------------------
// BALANCEADOR (Menor Carga Primero)
// ----------------------
function elegirNodo() {
  const vivos = Object.entries(nodos);
  if (!vivos.length) return null;

  vivos.sort((a, b) => a[1].carga - b[1].carga);
  return vivos[0]; // Retorna [id, data]
}

// ----------------------
// DESPACHO SEGURO
// ----------------------
async function dispatch(repo) {
  const target = elegirNodo();
  if (!target) return;

  const [id, node] = target;

  if (node.socket.writable) {
    node.socket.write(JSON.stringify({
      tipo: 'run',
      payload: repo,
      firma: firmar(repo)
    }));

    // Registrar quién es el dueño actual del proceso
    await redis.set(`proc:${repo.name}`, id, 'EX', 60);
    console.log(`🚀 Reprogramado ${repo.name} -> Nodo: ${id}`);
  }
}

// ----------------------
// RECONCILIACIÓN (Lógica de Líder)
// ----------------------
async function reconcile() {
  // 🔥 CRÍTICO: Solo el orquestador activo en la región manda
  if (!await soyActivo()) {
    // Si soy pasivo, solo observo
    return; 
  }

  const repos = JSON.parse(await redis.get('repos') || '[]');

  for (const repo of repos) {
    const owner = await redis.get(`proc:${repo.name}`);

    // Caso 1: Proceso huérfano
    if (!owner) {
      if (await lock(`lock:${repo.name}`)) {
        await dispatch(repo);
      }
      continue;
    }

    // Caso 2: El nodo que tenía el proceso ya no está en MI lista de nodos
    const alive = nodos[owner];
    if (!alive) {
      if (await lock(`lock:${repo.name}`)) {
        await dispatch(repo);
      }
    }
  }
}

// ----------------------
// LIMPIEZA DE SESIONES
// ----------------------
function limpiarNodosMuertos() {
  const t = now();
  for (const id in nodos) {
    if (t - nodos[id].lastSeen > 15000) {
      try { nodos[id].socket.destroy(); } catch (e) {}
      delete nodos[id];
      console.log(`🧹 Nodo ${id} eliminado por inactividad`);
    }
  }
}

// ----------------------
// LOOPS DE CONTROL
// ----------------------
setInterval(reconcile, 4000);
setInterval(limpiarNodosMuertos, 5000);
