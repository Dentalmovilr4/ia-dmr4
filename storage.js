const fsp = require('fs/promises');
const path = require('path');
const { BASE, DB } = require('./config');

const TEMP_DB = DB + '.tmp';
const BACKUP_DB = DB + '.bak';

const storage = {
  async guardarEstado(procesos) {
    try {
      // Validación básica (decisión automática)
      if (typeof procesos !== 'object' || procesos === null) {
        throw new Error('Estado inválido');
      }

      const data = JSON.stringify(procesos, null, 2);

      // Escribir archivo temporal primero
      await fsp.writeFile(TEMP_DB, data, 'utf8');

      // Backup del archivo actual si existe
      try {
        await fsp.copyFile(DB, BACKUP_DB);
      } catch {}

      // Reemplazo seguro
      await fsp.rename(TEMP_DB, DB);

    } catch (err) {
      console.error('Error guardando estado:', err.message);
    }
  },

  async cargarEstado() {
    try {
      const raw = await fsp.readFile(DB, 'utf8');
      return JSON.parse(raw);

    } catch (err) {
      console.warn('Error cargando estado, intentando backup...');

      // Decisión automática: intentar recuperar backup
      try {
        const rawBackup = await fsp.readFile(BACKUP_DB, 'utf8');
        return JSON.parse(rawBackup);
      } catch {
        console.error('No se pudo recuperar backup');
        return {};
      }
    }
  },

  rutaSegura(repo) {
    if (typeof repo !== 'string') return null;

    // Validación más estricta
    if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
      console.warn('Intento de ruta inválida:', repo);
      return null;
    }

    const basePath = path.resolve(BASE);
    const ruta = path.resolve(basePath, repo);

    // Protección contra path traversal
    if (!ruta.startsWith(basePath)) {
      console.warn('Intento de escape de directorio:', repo);
      return null;
    }

    return ruta;
  }
};

module.exports = storage;
