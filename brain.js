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

let estadoGlobal = {
  estrategia: 'CONSERVADOR',
  mercado: {},
  ultimaDecision: null,
  lock: false
};

// ----------------------
// CARGAR REPOS (NORMALIZADO)
// ----------------------
async function cargarRepos() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    // 🔥 Normalizar estructura
    return data.map(r => {
      if (typeof r === 'string') {
        return {
          name: r,
          prioridad: 5,
          critico: false,
          autoRestart: true,
          tipo: 'general'
        };
      }
      return r;
    });

  } catch {
    await alerta('error', 'Error cargando data.json');
    return [];
  }
}

// ----------------------
// OBSERVAR
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
// EJECUTAR
// ----------------------
async function ejecutar(repos, estrategia) {
  for (const repo of repos) {

    const procesos = manager.getProcesos();
    const activo = procesos[repo.name];
    const aprendizaje = await learning.evaluar(repo.name);

    // 🛡️ BLOQUEO
    if (aprendizaje === 'INESTABLE') {
      if (activo) {
        await manager.detener(repo.name);
        await alerta('error', `🛡️ ${repo.name} bloqueado por inestabilidad`);
      }
      continue;
    }

    try {
      switch (estrategia) {

        case 'DEFENSIVO':
          if (!repo.critico && activo) {
            await manager.detener(repo.name);
          }
          break;

        case 'CONSERVADOR':
          if (repo.prioridad >= 5 && !activo) {
            await manager.iniciar(repo.name);
            await learning.registrar(repo.name, 'exito');
          }
          break;

        case 'AGRESIVO':
          if (!activo) {
            await manager.iniciar(repo.name);
            await learning.registrar(repo.name, 'exito');
          }
          break;

        case 'EXPANSIVO':
          if (!activo && repo.autoRestart) {
            await manager.iniciar(repo.name);
            await learning.registrar(repo.name, 'exito');
          }
          break;
      }

    } catch (err) {
      await learning.registrar(repo.name, 'fallo');
      await alerta('error', `❌ Error en ${repo.name}: ${err.message}`);
    }
  }
}

// ----------------------
// CICLO
// ----------------------
async function ciclo() {

  if (estadoGlobal.lock) {
    console.log("⏳ Ciclo en ejecución, saltando...");
    return;
  }

  estadoGlobal.lock = true;

  try {
    const repos = await cargarRepos();
    const contexto = await observar();

    const nuevaEstrategia = await decidirEstrategia(contexto);

    // 🧠 Anti-flapping (cambio controlado)
    if (estadoGlobal.estrategia !== nuevaEstrategia) {
      console.log(`🔄 Cambio estrategia: ${estadoGlobal.estrategia} → ${nuevaEstrategia}`);
      await logSistema(`Cambio de estrategia: ${nuevaEstrategia}`);
    }

    await ejecutar(repos, nuevaEstrategia);

    estadoGlobal.estrategia = nuevaEstrategia;
    estadoGlobal.ultimaDecision = Date.now();

    console.log(`🤖 [${nuevaEstrategia}] ciclo OK`);

  } catch (err) {
    console.error("❌ Error ciclo:", err.message);
    await alerta('error', 'Fallo en núcleo IA');
  }

  estadoGlobal.lock = false;
}

// ----------------------
// START
// ----------------------
async function iniciarCerebro() {
  console.log("🧠 DMR4 PRO ONLINE");

  await manager.inicializar();

  setInterval(ciclo, INTERVALO);
  await ciclo();
}

module.exports = {
  iniciarCerebro,
  estadoGlobal
};