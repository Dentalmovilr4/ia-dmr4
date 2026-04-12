const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');

const app = express();

const BASE = process.env.BASE_DIR || '/data/data/com.termux/files/home/proyectos-dmr4';
const DB = path.join(__dirname, 'estado.json');
const PANEL_PORT = Number(process.env.PANEL_PORT || 3000);
const BASE_PORT = Number(process.env.BASE_PORT || 3100);
const MINT_DRM4 = process.env.MINT_DRM4 || '3CThGZU6DA6CdRMeYqnW12rtpudL9TgQPFT7qqu4NJ84';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let procesos = {}; 

// --- GESTIÓN DE LOGS ---
function obtenerRutaLog(repo) {
  return path.join(BASE, repo, 'output.log');
}

// --- UTILIDADES DE PROCESO ---
function procesoActivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function guardarEstado() {
  await fsp.writeFile(DB, JSON.stringify(procesos, null, 2), 'utf8');
}

async function cargarEstado() {
  try {
    const raw = await fsp.readFile(DB, 'utf8');
    const data = JSON.parse(raw);
    procesos = {};
    for (const [repo, info] of Object.entries(data)) {
      if (info?.pid && procesoActivo(info.pid)) {
        procesos[repo] = info;
      }
    }
  } catch {
    procesos = {};
  }
}

function nombreRepoValido(repo) {
  return /^[a-zA-Z0-9._-]+$/.test(repo);
}

function rutaSeguraRepo(repo) {
  if (!nombreRepoValido(repo)) return null;
  const ruta = path.resolve(BASE, repo);
  const base = path.resolve(BASE);
  if (!(ruta === base || ruta.startsWith(base + path.sep))) return null;
  return ruta;
}

function siguientePuertoLibre() {
  const usados = new Set(Object.values(procesos).map(x => x.port));
  let p = BASE_PORT;
  while (usados.has(p)) p++;
  return p;
}

function run(cmd, cwd) {
  return new Promise(resolve => {
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      resolve({
        error: err ? err.message : null,
        salida: stdout || stderr || ''
      });
    });
  });
}

// --- LANZAMIENTO CON REDIRECCIÓN DE LOGS ---
function lanzarProceso(repo, ruta) {
  const logStream = fs.createWriteStream(obtenerRutaLog(repo), { flags: 'a' });
  
  // Usamos process.execPath para asegurar que use el Node de Termux
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ruta,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'] // 'pipe' para capturar la salida
  });

  // Redirigir stdout y stderr al archivo .log
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  child.unref();
  return child.pid;
}

// --- ENDPOINTS DE LA API ---

// Nuevo: Ver logs de un repo específico
app.get('/api/repos/:repo/logs', async (req, res) => {
  const repo = req.params.repo;
  const rutaLog = obtenerRutaLog(repo);
  
  try {
    if (!fs.existsSync(rutaLog)) {
      return res.json({ logs: 'No hay logs disponibles aún.' });
    }
    // Leemos las últimas 100 líneas aproximadamente
    const logs = await fsp.readFile(rutaLog, 'utf8');
    res.json({ logs: logs.split('\n').slice(-100).join('\n') });
  } catch (e) {
    res.status(500).json({ error: 'Error al leer los logs' });
  }
});

// Limpiar logs
app.delete('/api/repos/:repo/logs', async (req, res) => {
  const repo = req.params.repo;
  const rutaLog = obtenerRutaLog(repo);
  try {
    if (fs.existsSync(rutaLog)) await fsp.unlink(rutaLog);
    res.json({ msg: 'Logs eliminados' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron eliminar los logs' });
  }
});

// (Resto de tus funciones startRepo, stopRepo, estado, etc. se mantienen igual)
// Solo asegúrate de cambiar la llamada a lanzarProceso en startRepo:
// const pid = lanzarProceso(repo, ruta);

async function startRepo(repo) {
  const ruta = rutaSeguraRepo(repo);
  if (!ruta) throw new Error('Repo inválido');
  const ya = procesos[repo];
  if (ya?.pid && procesoActivo(ya.pid)) return { msg: 'ya activo', port: ya.port };

  const port = ya?.port || siguientePuertoLibre();
  // ... (tu lógica de crearProyecto y asegurarDependencias)
  
  const pid = lanzarProceso(repo, ruta);
  procesos[repo] = { pid, port };
  await guardarEstado();
  return { msg: 'iniciado', port, pid };
}

// ... (resto del código del server)

(async () => {
  await cargarEstado();
  app.listen(PANEL_PORT, () => {
    console.log(`🔥 IA DMR4 FINAL con Logs en http://127.0.0.1:${PANEL_PORT}`);
  });
})();

