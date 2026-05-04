/**
 * IA-DMR4 PRO - CEREBRO TOTAL
 * Scheduler inteligente por nodo + Auto-scaling + Failover
 */

require('dotenv').config();

const manager = require('./processManager');
const learning = require('./learning');
const { decidirEstrategia } = require('./aiStrategy');
const { obtenerDatosToken } = require('./dex');
const { alerta, logSistema } = require('./bot');
const { pushTask } = require('./queue');
const { detectarFallos } = require('./failover');

const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const INTERVALO_IA = 30000;
const INTERVALO_FAILOVER = 5000;

let estadoGlobal = {
  estrategia: 'CONSERVADOR',
  mercado: {},
  ultimaDecision: null,
  lock: false,
  cluster: {}
};

// ----------------------
// CARGAR REPOS
// ----------------------
async function cargarRepos() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    return data.map(r => {
      const base = typeof r === 'string' ? { name: r } : r;
      return {
        name: base.name,
        prioridad: base.prioridad || 5,
        critico: base.critico || false,
        autoRestart: base.autoRestart ?? true,
        replicas: base.replicas || 1,
        tipo: base.tipo || 'general'
      };
    });

  } catch {
    await alerta('error', 'Error cargando data.json');
    return [];
  }
}

// ----------------------
// 🧠 OBTENER NODOS
// ----------------------
async function obtenerNodos() {
  const raw = await redis.hgetall('dmr4:nodes');

  const nodos = Object.entries(raw).map(([id, data]) => {
    const info = JSON.parse(data);
    return {
      id,
      cpu: info.cpu || 0,
      ram: info.ram || 0,
      timestamp: info.timestamp || 0
    };
  });

  return nodos;
}

// ----------------------
// 🧠 ELEGIR MEJOR NODO
// ----------------------
function elegirNodo(nodos) {
  if (nodos.length === 0) return null;

  // ordenar por menor carga (CPU + RAM)
  nodos.sort((a, b) => {
    const cargaA = a.cpu + a.ram;
    const cargaB = b.cpu + b.ram;
    return cargaA - cargaB;
  });

  return nodos[0]; // el más liviano
}

// ----------------------
// AUTO-SCALING INTELIGENTE
// ----------------------
async function escalarRepo(repo) {

  const procesosRaw = await redis.hgetall('dmr4:procesos');

  const actuales = Object.values(procesosRaw)
    .map(x => JSON.parse(x))
    .filter(p => p.repo === repo.name).length;

  if (actuales < repo.replicas) {

    const nodos = await obtenerNodos();
    const nodo = elegirNodo(nodos);

    if (!nodo) {
      console.log("⚠️ No hay nodos disponibles");
      return;
    }

    await pushTask({
      action: 'start',
      repo: repo.name,
      targetNode: nodo.id
    });

    console.log(`🚀 ${repo.name} → ${nodo.id}`);

  } else if (actuales > repo.replicas) {

    await pushTask({
      action: 'stop',
      repo: repo.name
    });

    console.log(`📉 Reduciendo ${repo.name}`);
  }
}

// ----------------------
// EJECUCIÓN IA
// ----------------------
async function ejecutar(repos, estrategia) {

  for (const repo of repos) {

    const aprendizaje = await learning.evaluar(repo.name);

    if (aprendizaje === 'INESTABLE') {
      await pushTask({ action: 'stop', repo: repo.name });
      continue;
    }

    try {

      switch (estrategia) {

        case 'DEFENSIVO':
          if (!repo.critico) {
            await pushTask({ action: 'stop', repo: repo.name });
          }
          break;

        case 'CONSERVADOR':
          if (repo.prioridad >= 5) {
            await escalarRepo(repo);
          }
          break;

        case 'AGRESIVO':
        case 'EXPANSIVO':
          await escalarRepo(repo);
          break;
      }

      await learning.registrar(repo.name, 'exito');

    } catch (err) {
      await learning.registrar(repo.name, 'fallo');
      await alerta('error', err.message);
    }
  }
}

// ----------------------
// CICLO IA
// ----------------------
async function cicloIA() {

  if (estadoGlobal.lock) return;
  estadoGlobal.lock = true;

  try {

    const repos = await cargarRepos();

    const mercado = await obtenerDatosToken();
    estadoGlobal.mercado = mercado;

    const estrategia = await decidirEstrategia({
      mercado,
      procesos: manager.getProcesos()
    });

    if (estadoGlobal.estrategia !== estrategia) {
      await logSistema(`Cambio estrategia: ${estrategia}`);
      estadoGlobal.estrategia = estrategia;
    }

    await ejecutar(repos, estrategia);

    estadoGlobal.ultimaDecision = Date.now();

    console.log(`🧠 [${estrategia}] OK`);

  } catch (err) {
    console.error("❌ Error IA:", err.message);
  }

  estadoGlobal.lock = false;
}

// ----------------------
// FAILOVER
// ----------------------
async function cicloFailover() {
  try {
    await detectarFallos();
  } catch (err) {
    console.error("❌ Failover error:", err.message);
  }
}

// ----------------------
// START
// ----------------------
async function iniciarCerebro() {

  console.log("🧠 DMR4 FULL CLUSTER ONLINE");

  await manager.inicializar();

  setInterval(cicloIA, INTERVALO_IA);
  setInterval(cicloFailover, INTERVALO_FAILOVER);

  await cicloIA();
}

module.exports = {
  iniciarCerebro,
  estadoGlobal
};