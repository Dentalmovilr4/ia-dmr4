const fs = require('fs/promises');
const path = require('path');

const DB = path.join(__dirname, 'optimizer.json');

let memoria = {};

// ----------------------
// CARGAR
// ----------------------
async function cargar() {
  try {
    memoria = JSON.parse(await fs.readFile(DB, 'utf8'));
  } catch {
    memoria = {};
  }
}

// ----------------------
// GUARDAR
// ----------------------
async function guardar() {
  await fs.writeFile(DB, JSON.stringify(memoria, null, 2));
}

// ----------------------
// REGISTRAR EVENTO
// ----------------------
async function registrar(repo, tipo, valor = 1) {
  if (!memoria[repo]) {
    memoria[repo] = {
      exito: 0,
      fallo: 0,
      score: 0
    };
  }

  memoria[repo][tipo] += valor;

  // 🧠 FÓRMULA DE SCORE
  const r = memoria[repo];
  r.score = (r.exito * 2) - (r.fallo * 3);

  await guardar();
}

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

module.exports = {
  cargar,
  registrar,
  getScore,
  ranking
};