const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const manager = require('./processManager');
const { BASE } = require('./config');

// ----------------------
// SEGURIDAD
// ----------------------

function rutaSegura(repo) {
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) return null;
  const ruta = path.resolve(BASE, repo);
  if (!ruta.startsWith(path.resolve(BASE))) return null;
  return ruta;
}

// ----------------------
// ANALIZADOR DE LOGS
// ----------------------

function clasificarError(log) {
  log = log.toLowerCase();

  if (log.includes('eaddrinuse')) return 'PUERTO_OCUPADO';
  if (log.includes('out of memory')) return 'MEMORIA';
  if (log.includes('cannot find module')) return 'DEPENDENCIA';
  if (log.includes('syntaxerror')) return 'SINTAXIS';
  if (log.includes('permission denied')) return 'PERMISOS';

  return 'DESCONOCIDO';
}

// ----------------------
// DECISIONES AUTOMÁTICAS
// ----------------------

async function tomarDecision(repo, tipoError) {
  switch (tipoError) {

    case 'PUERTO_OCUPADO':
      console.log(`🔁 Reiniciando ${repo} por conflicto de puerto`);
      await manager.detener(repo);
      return await manager.iniciar(repo);

    case 'MEMORIA':
      console.log(`⚠️ ${repo} consume mucha memoria → detenido`);
      return await manager.detener(repo);

    case 'DEPENDENCIA':
      console.log(`📦 ${repo} requiere npm install`);
      return { accion: 'instalar dependencias' };

    case 'SINTAXIS':
      console.log(`❌ Error de código en ${repo}`);
      return { accion: 'revisar código' };

    default:
      console.log(`🤔 Error desconocido en ${repo}`);
      return { accion: 'analisis manual' };
  }
}

// ----------------------
// DIAGNÓSTICO PRINCIPAL
// ----------------------

async function analizarFallo(repo) {
  const ruta = rutaSegura(repo);
  if (!ruta) {
    console.log('❌ Ruta inválida');
    return;
  }

  const logFile = path.join(ruta, 'output.log');

  try {
    const data = await fs.readFile(logFile, 'utf8');

    // Tomar últimas 20 líneas
    const lineas = data.split('\n').slice(-20).join('\n');

    console.log(`🔍 Analizando ${repo}...\n`);
    console.log(lineas);

    const tipo = clasificarError(lineas);

    console.log(`🧠 Tipo de error detectado: ${tipo}`);

    const decision = await tomarDecision(repo, tipo);

    return {
      repo,
      error: tipo,
      decision
    };

  } catch {
    console.log('❌ No se encontraron logs');
    return null;
  }
}

module.exports = { analizarFallo };
