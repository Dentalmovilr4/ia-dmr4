/**
 * IA-DMR4 PRO - NÚCLEO CENTRAL UNIFICADO
 * Incluye Estrategia IA y Auto-Scaling Cluster
 */

require('dotenv').config();
const manager = require('./processManager');
const learning = require('./learning');
const { decidirEstrategia } = require('./aiStrategy');
const { obtenerDatosToken } = require('./dex');
const { alerta, logSistema } = require('./bot');
const { pushTask } = require('./queue'); // Integración de cola de tareas

const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const INTERVALO_IA = 30000; // 30s para decisiones de mercado
const INTERVALO_CLUSTER = 15000; // 15s para auto-scaling

let estadoGlobal = {
  estrategia: 'CONSERVADOR',
  mercado: {},
  ultimaDecision: null,
  lock: false,
  cluster: {} // Seguimiento de réplicas activas
};

// ----------------------
// CARGAR Y NORMALIZAR REPOS
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
        replicas: base.replicas || 1, // Nuevo: Soporte para auto-scaling
        tipo: base.tipo || 'general'
      };
    });
  } catch {
    await alerta('error', 'Error cargando data.json');
    return [];
  }
}

// ----------------------
// LÓGICA DE AUTO-SCALING (INTEGRADA)
// ----------------------
async function gestionarEscalado(repo, activo) {
  const actuales = estadoGlobal.cluster[repo.name] || (activo ? 1 : 0);
  
  // Si faltan réplicas según la configuración del repo
  if (actuales < repo.replicas) {
    const faltan = repo.replicas - actuales;
    for (let i = 0; i < faltan; i++) {
      await pushTask({ action: 'start', repo: repo.name });
      console.log(`🚀 Escalando+: ${repo.name} (+1)`);
    }
    estadoGlobal.cluster[repo.name] = repo.replicas;
  } 
  // Si sobran réplicas (Scaling down)
  else if (actuales > repo.replicas) {
    await pushTask({ action: 'stop', repo: repo.name });
    console.log(`📉 Escalando-: ${repo.name} (-1)`);
    estadoGlobal.cluster[repo.name]--;
  }
}

// ----------------------
// EJECUCIÓN ESTRATÉGICA
// ----------------------
async function ejecutar(repos, estrategia) {
  for (const repo of repos) {
    const procesos = manager.getProcesos();
    const activo = procesos[repo.name];
    const aprendizaje = await learning.evaluar(repo.name);

    // 🛡️ Bloqueo por inestabilidad (Prioridad Máxima)
    if (aprendizaje === 'INESTABLE') {
      if (activo) {
        await pushTask({ action: 'stop', repo: repo.name });
        await alerta('error', `🛡️ ${repo.name} bloqueado por inestabilidad`);
      }
      continue;
    }

    try {
      // 1. Aplicar Estrategia de IA
      switch (estrategia) {
        case 'DEFENSIVO':
          if (!repo.critico && activo) await pushTask({ action: 'stop', repo: repo.name });
          break;

        case 'CONSERVADOR':
          if (repo.prioridad >= 5 && !activo) await pushTask({ action: 'start', repo: repo.name });
          break;

        case 'AGRESIVO':
        case 'EXPANSIVO':
          if (!activo) await pushTask({ action: 'start', repo: repo.name });
          break;
      }

      // 2. Aplicar Auto-Scaling (Mantener réplicas)
      await gestionarEscalado(repo, activo);

      if (activo) await learning.registrar(repo.name, 'exito');

    } catch (err) {
      await learning.registrar(repo.name, 'fallo');
      await alerta('error', `❌ Error en ejecución ${repo.name}: ${err.message}`);
    }
  }
}

// ----------------------
// CICLO OPERATIVO
// ----------------------
async function ciclo() {
  if (estadoGlobal.lock) return;
  estadoGlobal.lock = true;

  try {
    const repos = await cargarRepos();
    const mercado = await obtenerDatosToken();
    estadoGlobal.mercado = mercado;

    const nuevaEstrategia = await decidirEstrategia({ mercado, procesos: manager.getProcesos() });

    if (estadoGlobal.estrategia !== nuevaEstrategia) {
      await logSistema(`Cambio de estrategia: ${nuevaEstrategia}`);
      estadoGlobal.estrategia = nuevaEstrategia;
    }

    await ejecutar(repos, nuevaEstrategia);
    estadoGlobal.ultimaDecision = Date.now();
    console.log(`🧠 [${nuevaEstrategia}] Ciclo de cluster completado OK`);

  } catch (err) {
    console.error("❌ Error ciclo:", err.message);
  } finally {
    estadoGlobal.lock = false;
  }
}

// ----------------------
// ARRANQUE
// ----------------------
async function iniciarCerebro() {
  console.log("🧠 DMR4 PRO + CLUSTER MANAGER ONLINE");
  await manager.inicializar();

  // Ejecutar ciclos en sus respectivos intervalos
  setInterval(ciclo, INTERVALO_IA);
  await ciclo();
}

module.exports = { iniciarCerebro, estadoGlobal };
