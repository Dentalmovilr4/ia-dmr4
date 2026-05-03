require('dotenv').config();

const manager = require('./processManager');
const { obtenerDatosToken } = require('./dex');
const { alerta, logSistema } = require('./bot');
const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

// ----------------------
// CONFIG AUTÓNOMA
// ----------------------

const INTERVALO = 30000; // 30s
const LIMITE_FALLOS = 3;

let historial = {};

// ----------------------
// CARGAR REPOS
// ----------------------

async function cargarRepos() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

// ----------------------
// DECISIÓN MERCADO
// ----------------------

async function evaluarMercado() {
  const data = await obtenerDatosToken();

  if (data.error) {
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
}

// ----------------------
// DECISIÓN POR REPO
// ----------------------

async function evaluarRepo(repo, decisionMercado) {
  const procesos = manager.getProcesos();
  const activo = procesos[repo.name];

  // Inicializar historial
  if (!historial[repo.name]) {
    historial[repo.name] = { fallos: 0 };
  }

  // 🔥 DECISIONES

  // 1. Mercado manda
  if (repo.tipo === 'finanzas') {
    if (decisionMercado === 'STOP') {
      if (activo) {
        await manager.detener(repo.name);
        await alerta('warning', `${repo.name} detenido por mercado`);
      }
      return;
    }

    if (decisionMercado === 'RUN') {
      if (!activo) {
        await manager.iniciar(repo.name);
        await alerta('success', `${repo.name} iniciado por mercado`);
      }
    }
  }

  // 2. Prioridad
  if (repo.prioridad >= 5 && !activo) {
    await manager.iniciar(repo.name);
    await alerta('info', `${repo.name} iniciado por prioridad`);
  }

  // 3. Auto-restart
  if (repo.autoRestart && activo) {
    // si el proceso murió
    if (!activo.pid) {
      historial[repo.name].fallos++;

      if (historial[repo.name].fallos >= LIMITE_FALLOS) {
        await alerta('error', `${repo.name} falló demasiado → detenido`);
        await manager.detener(repo.name);
        return;
      }

      await manager.iniciar(repo.name);
      await alerta('warning', `${repo.name} reiniciado automáticamente`);
    }
  }

  // 4. Baja prioridad → apagar si no es crítico
  if (repo.prioridad < 3 && activo && !repo.critico) {
    await manager.detener(repo.name);
    await logSistema(`${repo.name} detenido por baja prioridad`);
  }
}

// ----------------------
// LOOP PRINCIPAL
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