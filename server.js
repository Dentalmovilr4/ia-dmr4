/**
 * IA-DMR4 PRO SERVER - Versión Unificada (Cerebro + API)
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
// CONFIGURACIÓN
// =========================
const BASE = process.env.BASE_DIR || path.join(process.env.HOME, 'ia-dmr4');
const DB = path.join(__dirname, 'estado.json');
const PANEL_PORT = process.env.PORT || 3000;
const BASE_PORT = 3100;
const API_KEY = process.env.DMR4_API_KEY || "dmr4-secret";

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let procesos = {};

// =========================
// UTILIDADES Y SEGURIDAD
// =========================

function auth(req) {
  return req.headers['x-api-key'] === API_KEY;
}

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
// PERSISTENCIA (STORAGE)
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
      console.warn('⚠️ Estado recuperado desde backup');
    } catch {
      procesos = {};
    }
  }

  for (const repo in procesos) {
    if (!procesoActivo(procesos[repo].pid)) {
      delete procesos[repo];
    }
  }
  await guardarEstado();
}

// =========================
// GESTIÓN DE PROCESOS
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
// API DE CONTROL IA (CEREBRO)
// =========================

app.post('/api/ai/execute', async (req, res) => {
  if (!auth(req)) return res.status(403).json({ error: 'No autorizado' });

  const { action, repo } = req.body;
  if (!repo) return res.status(400).json({ error: 'Repo requerido' });

  try {
    const ruta = rutaSegura(repo);

    if (action === 'start') {
      if (!ruta || !fs.existsSync(ruta)) return res.status(404).json({ error: 'Repo no existe' });
      if (procesos[repo] && procesoActivo(procesos[repo].pid)) return res.json({ msg: 'Ya activo', pid: procesos[repo].pid });

      const port = obtenerPuertoDisponible();
      const pid = lanzarProceso(repo, ruta, port);
      procesos[repo] = { pid, port };
      await guardarEstado();
      return res.json({ msg: 'iniciado', pid, port });
    }

    if (action === 'stop') {
      if (procesos[repo]) {
        try { process.kill(procesos[repo].pid); } catch {}
        delete procesos[repo];
        await guardarEstado();
      }
      return res.json({ msg: 'detenido' });
    }

    return res.status(400).json({ error: 'Acción inválida' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================
// API STANDARD Y LOGS
// =========================

app.get('/api/status', (req, res) => res.json(procesos));

app.get('/api/logs/:repo', async (req, res) => {
  const repo = req.params.repo;
  const ruta = rutaSegura(repo);
  if (!ruta) return res.status(400).json({ error: 'Ruta inválida' });

  try {
    const data = await fsp.readFile(obtenerRutaLog(repo), 'utf8');
    res.send(data);
  } catch {
    res.send('Sin logs disponibles');
  }
});

// =========================
// AUTO-RESTART Y ARRANQUE
// =========================

setInterval(async () => {
  for (const repo in procesos) {
    if (!procesoActivo(procesos[repo].pid)) {
      const ruta = rutaSegura(repo);
      if (ruta) {
        const pid = lanzarProceso(repo, ruta, procesos[repo].port);
        procesos[repo].pid = pid;
        await guardarEstado();
      }
    }
  }
}, 10000);

(async () => {
  await cargarEstado();
  app.listen(PANEL_PORT, '0.0.0.0', () => {
    console.log('\n🔥 IA-DMR4 PRO UNIFICADO ONLINE');
    console.log(`🌐 API/Panel: http://localhost:${PANEL_PORT}`);
    console.log(`🔐 AI Auth: Header 'x-api-key' requerido\n`);
  });
})();
