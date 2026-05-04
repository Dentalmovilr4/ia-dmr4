const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

const TIMEOUT = 10000;

// ----------------------
// OBTENER NODOS VIVOS
// ----------------------
async function obtenerNodosVivos() {

  const raw = await redis.hgetall('dmr4:nodes');
  const ahora = Date.now();

  const vivos = [];

  for (const [node, data] of Object.entries(raw)) {
    const info = JSON.parse(data);

    if (ahora - info.timestamp < TIMEOUT) {
      vivos.push({ node, ...info });
    }
  }

  return vivos;
}

// ----------------------
// SCORE DEL NODO
// ----------------------
function calcularScore(n) {

  // 🔥 fórmula simple pero efectiva
  return (n.cpu * 0.6) + (n.ram * 0.4);
}

// ----------------------
// ELEGIR MEJOR NODO
// ----------------------
async function elegirNodo() {

  const nodos = await obtenerNodosVivos();

  if (nodos.length === 0) return null;

  nodos.sort((a, b) => calcularScore(a) - calcularScore(b));

  return nodos[0].node; // el menos cargado
}

module.exports = { elegirNodo };