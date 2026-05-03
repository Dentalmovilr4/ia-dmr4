const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const { BASE, BASE_PORT } = require('./config');

let procesos = {};

// ----------------------
// UTILIDADES
// ----------------------

function procesoActivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function rutaSegura(repo) {
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) return null;
  const ruta = path.resolve(BASE, repo);
  if (!ruta.startsWith(path.resolve(BASE))) return null;
  return ruta;
}

function logPath(repo) {
  return path.join(BASE, repo, 'output.log');
}

// ----------------------
// MANAGER
// ----------------------

const manager = {

  async inicializar() {
    const data = await storage.cargarEstado();

    for (const [repo, info] of Object.entries(data)) {
      if (procesoActivo(info.pid)) {
        procesos[repo] = info;
      } else {
        console.log(`🧹 Eliminado proceso muerto: ${repo}`);
      }
    }

    await storage.guardarEstado(procesos);
  },

  getProcesos() {
    return procesos;
  },

  siguientePuerto() {
    const usados = new Set(Object.values(procesos).map(x => x.port));
    let p = BASE_PORT;
    while (usados.has(p)) p++;
    return p;
  },

  async iniciar(repo) {
    const ruta = rutaSegura(repo);
    if (!ruta) return { error: 'ruta inválida' };

    if (!fs.existsSync(ruta)) {
      return { error: 'repo no existe' };
    }

    // DECISIÓN: evitar duplicados
    if (procesos[repo] && procesoActivo(procesos[repo].pid)) {
      return { msg: 'ya activo', pid: procesos[repo].pid };
    }

    const port = this.siguientePuerto();

    const logStream = fs.createWriteStream(logPath(repo), { flags: 'a' });

    const child = spawn('node', ['server.js'], {
      cwd: ruta,
      env: { ...process.env, PORT: port },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
    child.unref();

    procesos[repo] = {
      pid: child.pid,
      port,
      startTime: Date.now()
    };

    await storage.guardarEstado(procesos);

    return { msg: 'iniciado', pid: child.pid, port };
  },

  async detener(repo) {
    const info = procesos[repo];
    if (!info) return { msg: 'no activo' };

    try {
      process.kill(info.pid, 'SIGTERM');
    } catch {}

    delete procesos[repo];
    await storage.guardarEstado(procesos);

    return { msg: 'detenido' };
  },

  // ----------------------
  // AUTO-RESTART (DECISIÓN)
  // ----------------------

  async monitorear() {
    for (const repo in procesos) {
      const info = procesos[repo];

      if (!procesoActivo(info.pid)) {
        console.log(`♻️ Reiniciando ${repo}`);

        const ruta = rutaSegura(repo);
        if (!ruta) continue;

        const logStream = fs.createWriteStream(logPath(repo), { flags: 'a' });

        const child = spawn('node', ['server.js'], {
          cwd: ruta,
          env: { ...process.env, PORT: info.port },
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        child.stdout.pipe(logStream);
        child.stderr.pipe(logStream);
        child.unref();

        procesos[repo].pid = child.pid;

        await storage.guardarEstado(procesos);
      }
    }
  }

};

// Loop automático (decisiones constantes)
setInterval(() => {
  manager.monitorear();
}, 10000);

module.exports = manager;
