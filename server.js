const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');

const app = express();

// CORRECCIÓN DE RUTA: Ajustado a tu carpeta real en Termux
const BASE = process.env.BASE_DIR || path.join(process.env.HOME, 'ia-dmr4'); 
const DB = path.join(__dirname, 'estado.json');
const PANEL_PORT = 3000;
const BASE_PORT = 3100;

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
    procesos = JSON.parse(raw);
    // Limpiar procesos muertos al arrancar
    for (const repo in procesos) {
      if (!procesoActivo(procesos[repo].pid)) {
        delete procesos[repo];
      }
    }
  } catch {
    procesos = {};
  }
}

// --- ENDPOINTS ---

app.get('/api/status', (req, res) => {
  res.json(procesos);
});

app.get('/api/liquidez', (req, res) => {
  // Simulación de datos de Solana para el panel
  res.json({ liquidez: 150.50, precio: "0.000045", activo: true });
});

// Lanzamiento de procesos
function lanzarProceso(repo, ruta) {
  const logStream = fs.createWriteStream(obtenerRutaLog(repo), { flags: 'a' });
  const child = spawn('node', ['server.js'], {
    cwd: ruta,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  child.unref();
  return child.pid;
}

app.post('/api/start/:repo', async (req, res) => {
  const repo = req.params.repo;
  const ruta = path.join(BASE, repo);
  
  if (!fs.existsSync(ruta)) return res.status(404).json({error: "Repo no existe"});
  
  const pid = lanzarProceso(repo, ruta);
  procesos[repo] = { pid, port: BASE_PORT + Object.keys(procesos).length };
  await guardarEstado();
  res.json({msg: "Iniciado", pid: pid});
});

app.post('/api/stop/:repo', async (req, res) => {
    const repo = req.params.repo;
    if (procesos[repo]) {
        try { process.kill(procesos[repo].pid); } catch(e) {}
        delete procesos[repo];
        await guardarEstado();
    }
    res.json({msg: "Detenido"});
});

// --- ARRANCAR SERVIDOR ---
(async () => {
  await cargarEstado();
  // ESCUCHAR EN 0.0.0.0 PARA EVITAR BLOQUEOS EN EL MÓVIL
  app.listen(PANEL_PORT, '0.0.0.0', () => {
    console.log(`\n🔥 IA DMR4 FINAL ONLINE`);
    console.log(`🌐 Panel: http://localhost:${PANEL_PORT}`);
    console.log(`📂 Ruta Base: ${BASE}\n`);
  });
})();

