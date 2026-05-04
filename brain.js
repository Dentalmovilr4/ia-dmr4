/**
 * IA-DMR4 PRO - NÚCLEO CENTRAL UNIFICADO + FAILOVER
 */

require('dotenv').config();

const manager = require('./processManager');
const learning = require('./learning');
const { decidirEstrategia } = require('./aiStrategy');
const { obtenerDatosToken } = require('./dex');
const { alerta, logSistema } = require('./bot');
const { pushTask } = require('./queue');
const { detectarFallos } = require('./failover');

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
// AUTO-SCALING
// ----------------------
async function gestionarEscalado(repo, activo) {

  const actuales = estadoGlobal.cluster[repo.name] || (activo ? 1 : 0);

  if (actuales < repo.replicas) {

    const faltan = repo.replicas - actuales;

    for (let i = 0; i < faltan; i++) {
      await pushTask({ action: 'start', repo: repo.name });
      console.log(`🚀 Escalando+: ${repo.name}`);
    }

    estadoGlobal.cluster[repo.name] = repo.replicas;

  } else if (actuales > repo.replicas) {

    await pushTask({ action: 'stop', repo: repo.name });
    console.log(`📉 Escalando-: ${repo.name}`);

    estadoGlobal.cluster[repo.name]--;
  }
}

// ----------------------
// EJECUCIÓN IA
// ----------------------
async function ejecutar(repos, estrategia) {

  for (const repo of repos) {

    const procesos = manager.getProcesos();
    const activo = procesos[repo.name];
    const aprendizaje = await learning.evaluar(repo.name);

    // 🛡️ BLOQUEO
    if (aprendizaje === 'INESTABLE') {
      if (activo) {
        await pushTask({ action: 'stop', repo: repo.name });
        await alerta('error', `🛡️ ${repo.name} bloqueado`);
      }
      continue;
    }

    try {

      switch (estrategia) {

        case 'DEFENSIVO':
          if (!repo.critico && activo) {
            await pushTask({ action: 'stop', repo: repo.name });
          }
          break;

        case 'CONSERVADOR':
          if (repo.prioridad >= 5 && !activo) {
            await pushTask({ action: 'start', repo: repo.name });
          }
          break;

        case 'AGRESIVO':
        case 'EXPANSIVO':
          if (!activo) {
            await pushTask({ action: 'start', repo: repo.name });
          }
          break;
      }

      await gestionarEscalado(repo, activo);

      if (activo) {
        await learning.registrar(repo.name, 'exito');
      }

    } catch (err) {
      await learning.registrar(repo.name, 'fallo');
      await alerta('error', `❌ Error en ${repo.name}: ${err.message}`);
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

    const nuevaEstrategia = await decidirEstrategia({
      mercado,
      procesos: manager.getProcesos()
    });

    if (estadoGlobal.estrategia !== nuevaEstrategia) {
      await logSistema(`Cambio estrategia: ${nuevaEstrategia}`);
      estadoGlobal.estrategia = nuevaEstrategia;
    }

    await ejecutar(repos, nuevaEstrategia);

    estadoGlobal.ultimaDecision = Date.now();

    console.log(`🧠 [${nuevaEstrategia}] ciclo OK`);

  } catch (err) {
    console.error("❌ Error IA:", err.message);
  }

  estadoGlobal.lock = false;
}

// ----------------------
// CICLO FAILOVER
// ----------------------
async function cicloFailover() {
  try {
    await detectarFallos();
  } catch (err) {
    console.error("❌ Error failover:", err.message);
  }
}

// ----------------------
// START
// ----------------------
async function iniciarCerebro() {

  console.log("🧠 DMR4 PRO + CLUSTER + FAILOVER ONLINE");

  await manager.inicializar();

  // IA (decisiones)
  setInterval(cicloIA, INTERVALO_IA);

  // FAILOVER (alta frecuencia)
  setInterval(cicloFailover, INTERVALO_FAILOVER);

  // ejecución inmediata
  await cicloIA();
}

module.exports = {
  iniciarCerebro,
  estadoGlobal
};
