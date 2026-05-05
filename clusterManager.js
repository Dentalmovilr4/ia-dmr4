const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

let workers = {};

/**
 * Inicia un proceso hijo (Worker) de forma independiente.
 * @param {string} nombre - Nombre identificador del proceso.
 * @param {string} scriptPath - Ruta relativa al archivo .js
 */
function iniciar(nombre, scriptPath) {
  if (workers[nombre]) {
    console.log(`⚠️ ${nombre} ya está en ejecución.`);
    return;
  }

  // Validar si el archivo existe antes de intentar lanzarlo
  const rutaAbsoluta = path.resolve(__dirname, scriptPath);
  if (!fs.existsSync(rutaAbsoluta)) {
    console.error(`❌ Error: No se encontró el script para ${nombre} en ${rutaAbsoluta}`);
    return;
  }

  try {
    const worker = fork(rutaAbsoluta);

    workers[nombre] = {
      process: worker,
      pid: worker.pid,
      fechaInicio: new Date().toLocaleString()
    };

    console.log(`🚀 [${nombre}] iniciado con éxito (PID: ${worker.pid})`);

    // Manejo de eventos de salida
    worker.on('exit', (code) => {
      console.log(`💀 [${nombre}] terminó con código de salida: ${code}`);
      delete workers[nombre];
    });

    // Manejo de errores internos del worker
    worker.on('error', (err) => {
      console.error(`💥 Error crítico en worker ${nombre}:`, err.message);
    });

  } catch (error) {
    console.error(`❌ Fallo al ejecutar fork para ${nombre}:`, error.message);
  }
}

/**
 * Detiene un proceso hijo mediante su nombre.
 */
function detener(nombre) {
  if (!workers[nombre]) {
    console.log(`ℹ️ El proceso ${nombre} no está activo.`);
    return;
  }

  try {
    workers[nombre].process.kill('SIGTERM'); // Intento de cierre elegante
    delete workers[nombre];
    console.log(`🛑 [${nombre}] ha sido detenido manualmente.`);
  } catch (error) {
    console.error(`❌ No se pudo detener ${nombre}:`, error.message);
  }
}

/**
 * Retorna el estado actual de todos los procesos activos.
 */
function getProcesos() {
  const info = {};
  for (const key in workers) {
    info[key] = {
      pid: workers[key].pid,
      inicio: workers[key].fechaInicio
    };
  }
  return info;
}

/**
 * Inicialización opcional (limpieza de procesos previos si fuera necesario)
 */
async function inicializar() {
  console.log("📂 Gestor de Procesos DMR4 preparado.");
  workers = {};
}

module.exports = {
  iniciar,
  detener,
  getProcesos,
  inicializar
};
