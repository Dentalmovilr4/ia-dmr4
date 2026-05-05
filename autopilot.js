require('dotenv').config();

const manager = require('./processManager');
const { obtenerDatosToken } = require('./dex');
const { alerta, logSistema } = require('./bot');
const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const INTERVALO = 30000;
const LIMITE_FALLOS = 3;

let historial = {};

// ----------------------
// CARGAR REPOS
// ----------------------
async function cargarRepos() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ data.json no encontrado o inválido");
    return [];
  }
}

// ----------------------
// MERCADO
// ----------------------
async function evaluarMercado() {
  try {
    const data = await obtenerDatosToken();

    if (!data || data.error) {
      await alerta('warning', 'Error obteniendo datos del token');
      return null;
    }

    if (data.estado === 'MUERTO') {
      await alerta('warning', 'Token sin liquidez');
      return 'STOP';
    }

    if (data.estado === 'SALUDABLE') {
      return 'RUN';
    }

    return 'HOLD';

  } catch (err) {
    await alerta('error', 'Fallo en evaluarMercado');
    return null;
  }
}

// ----------------------
// REPO
// ----------------------
async function evaluarRepo(repo, decisionMercado) {
  const procesos = manager.getProcesos();
  const activo = procesos[repo.name];

  if (!historial[repo.name]) {
    historial[repo.name] = { fallos: 0 };
  }

  // MERCADO MANDA
  if (repo.tipo === 'finanzas') {
    if (decisionMercado === 'STOP' && activo) {
      await manager.detener(repo.name);
      await alerta('warning', `${repo.name} detenido por mercado`);
      return;
    }

    if (decisionMercado === 'RUN' && !activo) {
      await manager.iniciar(repo.name);
      await alerta('success', `${repo.name} iniciado por mercado`);
    }
  }

  // PRIORIDAD
  if (repo.prioridad >= 5 && !activo) {
    await manager.iniciar(repo.name);
    await alerta('info', `${repo.name} iniciado por prioridad`);
  }

  // AUTO-RESTART REAL
  if (repo.autoRestart) {
    if (!activo || !activo.pid) {
      historial[repo.name].fallos++;

      if (historial[repo.name].fallos >= LIMITE_FALLOS) {
        await alerta('error', `${repo.name} falló demasiado → detenido`);
        await manager.detener(repo.name);
        return;
      }

      await manager.iniciar(repo.name);
      await alerta('warning', `${repo.name} reiniciado`);
    } else {
      historial[repo.name].fallos = 0;
    }
  }

  // BAJA PRIORIDAD
  if (repo.prioridad < 3 && activo && !repo.critico) {
    await manager.detener(repo.name);
    await logSistema(`${repo.name} detenido por baja prioridad`);
  }
}

// ----------------------
// LOOP
// ----------------------
async function ciclo() {
  try {
    const repos = await cargarRepos();
    const decisionMercado = await evaluarMercado();

    for (const repo of repos) {
      await evaluarRepo(repo, decisionMercado);
    }

  } catch (err) {
    console.error("❌ Error en autopilot:", err.message);
    await alerta('error', 'Fallo en autopilot');
  }
}

// ----------------------
// START
// ----------------------
(async () => {
  console.log("🧠 AUTOPILOT DMR4 INICIADO");

  await manager.inicializar();

  setInterval(ciclo, INTERVALO);
})();
