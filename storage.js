const fsp = require('fs/promises');
const path = require('path');
const { BASE, DB } = require('./config');

const storage = {
  async guardarEstado(procesos) {
    await fsp.writeFile(DB, JSON.stringify(procesos, null, 2), 'utf8');
  },
  
  async cargarEstado() {
    try {
      const raw = await fsp.readFile(DB, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  rutaSegura(repo) {
    if (!/^[a-zA-Z0-9._-]+$/.test(repo)) return null;
    const ruta = path.resolve(BASE, repo);
    if (!ruta.startsWith(path.resolve(BASE))) return null;
    return ruta;
  }
};

module.exports = storage;
