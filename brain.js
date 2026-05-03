require('dotenv').config();

const manager = require('./processManager');
const learning = require('./learning');
const { decidirEstrategia } = require('./aiStrategy');
const { obtenerDatosToken } = require('./dex');
const { alerta, logSistema } = require('./bot');

const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const INTERVALO = 30000;

// ----------------------
// ESTADO GLOBAL
// ----------------------

let estadoGlobal = {
  estrategia: 'CONSERVADOR',
  mercado: {},
  ultimaDecision: null
};

// ----------------------
// CARGAR REPOS
// ----------------------

async function cargarRepos() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

// ----------------------
// OBSERVAR SISTEMA
// ----------------------

async function observar() {
  const mercado = await obtenerDatosToken();

  estadoGlobal.mercado = mercado;

  return {
    mercado,
    procesos: manager.getProcesos()
  };
}

// ----------------------
// DECIDIR
// ----------------------

async function decidir(contexto) {
  const estrategia = await decidirEstrategia();

  estadoGlobal.estrategia = estrategia;

  return estrategia;
}

// ----------------------
// EJECUTAR DECISIONES
// ----------------------

async function ejecutar(repos, estrategia) {
  for (const repo of repos) {
    const procesos = manager.getProcesos();
    const activo = procesos[repo.name];

    const aprendizaje = await learning.evaluar(repo.name);

    // 🔥 BLOQUEO POR APRENDIZAJE
    if (aprendizaje === 'INESTABLE') {
      if (activo) {
        await manager.detener(repo.name);
        await alerta('error', `${repo.name} bloqueado por IA (inestable)`);
      }
      continue;
    }

    // 🔥 ESTRATEGIAS

    if (estrategia === 'DEFENSIVO') {
      if (!repo.critico && activo) {
        await manager.detener(repo.name);
        await logSistema(`${repo.name} detenido (modo defensivo)`);
      }
      continue;
    }

    if (estrategia === 'CONSERVADOR') {
      if (repo.prioridad >= 5 && !activo) {
        await manager.iniciar(repo.name);
        await learning.registrar(repo.name, 'exito');
      }
      continue;
    }

    if (estrategia === 'AGRESIVO') {
      if (!activo) {
        await manager.iniciar(repo.name);
        await learning.registrar(repo.name, 'exito');
      }
      continue;
    }

    if (estrategia === 'EXPANSIVO') {
      if (!activo && repo.autoRestart) {
        await manager.iniciar(repo.name);
        await learning.registrar(repo.name, 'exito');
      }
    }
  }
}

// ----------------------
// CICLO PRINCIPAL
// ----------------------

async function ciclo() {
  try {
    const repos = await cargarRepos();

    const contexto = await observar();

    const estrategia = await decidir(contexto);

    await ejecutar(repos, estrategia);

    estadoGlobal.ultimaDecision = Date.now();

    console.log(`🧠 Estrategia actual: ${estrategia}`);

  } catch (err) {
    console.error("❌ Error en cerebro:", err.message);
    await alerta('error', 'Fallo crítico en brain');
  }
}

// ----------------------
// START
// ----------------------

async function iniciarCerebro() {
  console.log("🧠 CEREBRO DMR4 ONLINE");

  await manager.inicializar();

  setInterval(ciclo, INTERVALO);
}

// ----------------------

module.exports = {
  iniciarCerebro,
  estadoGlobal
};