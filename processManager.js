const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const storage = require('./storage'); // Asegúrate de que storage.js exista
const { BASE, BASE_PORT } = require('./config'); // Asegúrate de que config.js tenga estos valores

let procesos = {};

// ----------------------
// UTILIDADES INTERNAS
// ----------------------

function procesoActivo(pid) {
  try {
    // Señal 0 solo verifica si el proceso existe
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function rutaSegura(scriptPath) {
  // Resuelve la ruta del script relativa a la base del proyecto
  const ruta = path.resolve(__dirname, scriptPath);
  return fs.existsSync(ruta) ? ruta : null;
}

function logPath(nombre) {
  const dirLog = path.join(__dirname, 'logs');
  if (!fs.existsSync(dirLog)) fs.mkdirSync(dirLog);
  return path.join(dirLog, `${nombre}.log`);
}

// ----------------------
// GESTOR UNIFICADO
// ----------------------

const manager = {

  async inicializar() {
    console.log("📂 Inicializando Gestor de Procesos DMR4...");
    const data = await storage.cargarEstado().catch(() => ({}));

    for (const [nombre, info] of Object.entries(data)) {
      if (procesoActivo(info.pid)) {
        procesos[nombre] = info;
      } else {
        console.log(`🧹 Limpiando proceso antiguo: ${nombre}`);
      }
    }
    await storage.guardarEstado(procesos);
  },

  getProcesos() {
    // Retorna el estado actual para el Autopilot
    return procesos;
  },

  siguientePuerto() {
    const usados = new Set(Object.values(procesos).map(x => x.port));
    let p = BASE_PORT || 3000;
    while (usados.has(p)) p++;
    return p;
  },

  async iniciar(nombre, scriptPath) {
    const ruta = rutaSegura(scriptPath);
    if (!ruta) {
      console.error(`❌ Error: No se encontró ${scriptPath}`);
      return { error: 'archivo no existe' };
    }

    // Evitar duplicados si ya está vivo
    if (procesos[nombre] && procesoActivo(procesos[nombre].pid)) {
      return { msg: 'ya activo', pid: procesos[nombre].pid };
    }

    const port = this.siguientePuerto();
    const logStream = fs.createWriteStream(logPath(nombre), { flags: 'a' });

    // Lanzamiento del proceso hijo
    const child = spawn('node', [ruta], {
      cwd: path.dirname(ruta),
      env: { ...process.env, PORT: port },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
    child.unref(); // Permite que el padre (Termux) siga independiente

    procesos[nombre] = {
      pid: child.pid,
      port,
      path: scriptPath,
      startTime: Date.now()
    };

    await storage.guardarEstado(procesos);
    console.log(`🚀 [${nombre}] iniciado en puerto ${port} (PID: ${child.pid})`);
    
    return { msg: 'iniciado', pid: child.pid, port };
  },

  async detener(nombre) {
    const info = procesos[nombre];
    if (!info) return { msg: 'no activo' };

    try {
      process.kill(info.pid, 'SIGTERM');
      console.log(`🛑 [${nombre}] detenido.`);
    } catch (err) {
      console.error(`⚠️ No se pudo matar el proceso ${info.pid}`);
    }

    delete procesos[nombre];
    await storage.guardarEstado(procesos);
    return { msg: 'detenido' };
  },

  // ----------------------
  // MONITOR DE AUTOCURACIÓN
  // ----------------------
  async monitorear() {
    for (const nombre in procesos) {
      const info = procesos[nombre];
      if (!procesoActivo(info.pid)) {
        console.log(`♻️ Reiniciando automáticamente: ${nombre}`);
        await this.iniciar(nombre, info.path);
      }
    }
  }
};

// Ciclo de vigilancia cada 10 segundos
setInterval(() => {
  manager.monitorear();
}, 10000);

module.exports = manager;

