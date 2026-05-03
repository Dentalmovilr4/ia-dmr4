const path = require('path');

// ----------------------
// ENTORNO
// ----------------------

const ENV = process.env.NODE_ENV || 'development';

// ----------------------
// CONFIG BASE
// ----------------------

const BASE = process.env.BASE_DIR || path.join(
  process.env.HOME || '/data/data/com.termux/files/home',
  'proyectos-dmr4'
);

const DB = path.join(__dirname, 'estado.json');

// ----------------------
// PUERTOS
// ----------------------

const PANEL_PORT = Number(process.env.PANEL_PORT || 3000);
const BASE_PORT = Number(process.env.BASE_PORT || 3100);

// ----------------------
// TOKEN CONFIG
// ----------------------

const MINT_DMR4 = process.env.MINT_DMR4 || '3CThGZU6DA6CdRMeYqnW12rtpudL9TgQPFT7qqu4NJ84';

// ----------------------
// VALIDACIÓN INTELIGENTE
// ----------------------

function validarConfig() {
  const errores = [];

  if (!BASE) errores.push('BASE no definida');
  if (!PANEL_PORT) errores.push('PANEL_PORT inválido');
  if (!BASE_PORT) errores.push('BASE_PORT inválido');

  if (errores.length > 0) {
    console.error('❌ CONFIG ERROR:\n', errores.join('\n'));
    process.exit(1);
  }

  // Decisión automática según entorno
  if (ENV === 'development') {
    console.log('🧪 Modo desarrollo activo');
  }

  if (ENV === 'production') {
    console.log('🚀 Modo producción activo');
  }
}

// Ejecutar validación al cargar
validarConfig();

// ----------------------

module.exports = {
  ENV,
  BASE,
  DB,
  PANEL_PORT,
  BASE_PORT,
  MINT_DMR4
};