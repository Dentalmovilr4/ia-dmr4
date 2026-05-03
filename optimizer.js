const fs = require('fs/promises');
const path = require('path');

const DB = path.join(__dirname, 'optimizer.json');

let memoria = {};
let dirty = false;

// ----------------------
// CARGAR
// ----------------------
async function cargar() {
  try {
    const raw = await fs.readFile(DB, 'utf8');
    memoria = JSON.parse(raw);
  } catch {
    memoria = {};
  }
}

// ----------------------
// GUARDAR (SEGURA)
// ----------------------
async function guardar() {
  if (!dirty) return;

  const tmp = DB + '.tmp';

  await fs.writeFile(tmp, JSON.stringify(memoria, null, 2));
  await fs.rename(tmp, DB);

  dirty = false;
}

// ----------------------
// REGISTRAR EVENTO
// ----------------------
async function registrar(repo, tipo, valor = 1) {
  if (!memoria[repo]) {
    memoria[repo] = {
      exito: 0,
      fallo: 0,
      score: 0,
      lastUpdate: Date.now()
    };
  }

  const r = memoria[repo];

  // ----------------------
  // DECAY (envejecimiento)
  // ----------------------
  const ahora = Date.now();
  const horas = (ahora - r.lastUpdate) / 3600000;

  if (horas > 1) {
    r.exito *= 0.9;
    r.fallo *= 0.9;
  }

  r.lastUpdate = ahora;

  // ----------------------
  // REGISTRO
  // ----------------------
  if (tipo === 'exito') r.exito += valor;
  if (tipo === 'fallo') r.fallo += valor;

  // ----------------------
  // SCORE INTELIGENTE
  // ----------------------
  const estabilidad = r.exito / (r.exito + r.fallo + 1);

  r.score =
    (r.exito * 1.5) -
    (r.fallo * 2.5) +
    (estabilidad * 5);

  dirty = true;
}

// ----------------------
// AUTO-GUARDADO
// ----------------------
setInterval(() => {
  guardar().catch(() => {});
}, 10000);

// ----------------------
// OBTENER SCORE
// ----------------------
function getScore(repo) {
  return memoria[repo]?.score || 0;
}

// ----------------------
// RANKING
// ----------------------
function ranking() {
  return Object.entries(memoria)
    .sort((a, b) => b[1].score - a[1].score);
}

// ----------------------
// DEBUG (opcional)
// ----------------------
function debug() {
  return memoria;
}

module.exports = {
  cargar,
  registrar,
  getScore,
  ranking,
  debug
};