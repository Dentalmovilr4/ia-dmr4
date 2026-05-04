const axios = require('axios');
const nodes = require('./nodes.json');

const KEY = process.env.DMR4_API_KEY || 'dmr4-secret';

// elegir nodo con menos carga
function elegirNodo(status) {
  return nodes.sort((a, b) => {
    const cargaA = Object.keys(status[a.name] || {}).length;
    const cargaB = Object.keys(status[b.name] || {}).length;
    return cargaA - cargaB;
  })[0];
}

async function ejecutarEnNodo(action, repo, statusGlobal) {
  const nodo = elegirNodo(statusGlobal);

  try {
    const res = await axios.post(
      `${nodo.url}/api/ai/execute`,
      { action, repo },
      { headers: { 'x-api-key': KEY } }
    );

    return res.data;

  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { ejecutarEnNodo };