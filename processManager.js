const { spawn, exec } = require('child_process');
const storage = require('./storage');
const { BASE_PORT } = require('./config');

let procesos = {};

const manager = {
  async inicializar() {
    const data = await storage.cargarEstado();
    // Filtrar solo los que siguen vivos al arrancar
    for (const [repo, info] of Object.entries(data)) {
      try {
        process.kill(info.pid, 0);
        procesos[repo] = info;
      } catch {}
    }
  },

  getProcesos() { return procesos; },

  siguientePuerto() {
    const usados = new Set(Object.values(procesos).map(x => x.port));
    let p = BASE_PORT;
    while (usados.has(p)) p++;
    return p;
  },

  async detener(repo) {
    const info = procesos[repo];
    if (!info) return { msg: 'no activo' };
    try {
      process.kill(info.pid, 'SIGTERM');
      delete procesos[repo];
      await storage.guardarEstado(procesos);
      return { msg: 'detenido' };
    } catch (e) {
      return { error: e.message };
    }
  }
  // Aquí incluirías también startRepo y crearProyecto...
};

module.exports = manager;
