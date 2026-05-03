/**
 * IA-DMR4 PRO SERVER - Versión limpia y robusta
 */

require('dotenv').config();

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();

// =========================
// CONFIG
// =========================

const BASE = process.env.BASE_DIR || path.join(process.env.HOME, 'ia-dmr4');
const DB = path.join(__dirname, 'estado.json');
const PANEL_PORT = 3000;
const BASE_PORT = 3100;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let procesos = {};

// =========================
// UTILIDADES
// =========================

function rutaSegura(repo) {
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) return null;
  const ruta = path.resolve(BASE, repo);
  if (!ruta.startsWith(path.resolve(BASE))) return null;
  return ruta;
}

function procesoActivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function obtenerPuertoDisponible() {
  const usados = Object.values(procesos).map(p => p.port);
  let puerto = BASE_PORT;
  while (usados.includes(puerto)) puerto++;
  return puerto;
}

function obtenerRutaLog(repo) {
  return path.join(BASE, repo, 'output.log');
}

// =========================
// STORAGE SEGURO
// =========================

async function guardarEstado() {
  const tmp = DB + '.tmp';
  const bak = DB + '.bak';

  try {
    const data = JSON.stringify(procesos, null, 2);

    await fsp.writeFile(tmp, data, 'utf8');

    try { await fsp.copyFile(DB, bak); } catch {}

    await fsp.rename(tmp, DB);

  } catch (err) {
    console.error('❌ Error guardando estado:', err.message);
  }
}

async function cargarEstado() {
  try {
    const raw = await fsp.readFile(DB, 'utf8');
    procesos = JSON.parse(raw);
  } catch {
    try {
      const raw = await fsp.readFile(DB + '.bak', 'utf8');
      procesos = JSON.parse(raw);
      console.warn('⚠️ Recuperado desde backup');
    } catch {
      procesos = {};
    }
  }

  for (const repo in procesos) {
    if (!procesoActivo(procesos[repo].pid)) {
      console.log(`🧹 Eliminando proceso muerto: ${repo}`);
      delete procesos[repo];
    }
  }

  await guardarEstado();
}

// =========================
// PROCESOS
// =========================

function lanzarProceso(repo, ruta, port) {
  const logPath = obtenerRutaLog(repo);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  const child = spawn('node', ['server.js'], {
    cwd: ruta,
    env: { ...process.env, PORT: port },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  child.unref();

  return child.pid;
}

// =========================
// API
// =========================

app.get('/api/status', (req, res) => {
  res.json(procesos);
});

app.get('/api/logs/:repo', async (req, res) => {
  const repo = req.params.repo;
  const ruta = rutaSegura(repo);

  if (!ruta) return res.status(400).json({ error: 'Ruta inválida' });

  const logPath = obtenerRutaLog(repo);

  try {
    const data = await fsp.readFile(logPath, 'utf8');
    res.send(data);
  } catch {
    res.send('Sin logs');
  }
});

app.post('/api/start/:repo', async (req, res) => {
  const repo = req.params.repo;
  const ruta = rutaSegura(repo);

  if (!ruta || !fs.existsSync(ruta)) {
    return res.status(404).json({ error: 'Repo no existe' });
  }

  if (procesos[repo] && procesoActivo(procesos[repo].pid)) {
    return res.json({ msg: 'Ya está corriendo', pid: procesos[repo].pid });
  }

  const port = obtenerPuertoDisponible();
  const pid = lanzarProceso(repo, ruta, port);

  procesos[repo] = { pid, port };

  await guardarEstado();

  res.json({ msg: 'Iniciado', pid, port });
});

app.post('/api/stop/:repo', async (req, res) => {
  const repo = req.params.repo;

  if (procesos[repo]) {
    try {
      process.kill(procesos[repo].pid);
    } catch {}

    delete procesos[repo];
    await guardarEstado();
  }

  res.json({ msg: 'Detenido' });
});

// =========================
// AUTO-RESTART INTELIGENTE
// =========================

setInterval(async () => {
  for (const repo in procesos) {
    if (!procesoActivo(procesos[repo].pid)) {
      console.log(`♻️ Reiniciando ${repo}`);

      const ruta = rutaSegura(repo);
      if (!ruta) continue;

      const port = procesos[repo].port;
      const pid = lanzarProceso(repo, ruta, port);

      procesos[repo].pid = pid;
      await guardarEstado();
    }
  }
}, 10000);

// =========================
// START
// =========================

(async () => {
  await cargarEstado();

  app.listen(PANEL_PORT, '0.0.0.0', () => {
    console.log('\n🔥 IA-DMR4 PRO ONLINE');
    console.log(`🌐 Panel: http://localhost:${PANEL_PORT}`);
    console.log(`📂 Base: ${BASE}\n`);
  });
})();