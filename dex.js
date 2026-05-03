const { MINT_DMR4 } = require('./config');

// ----------------------
// CLASIFICADOR
// ----------------------

function evaluarToken({ liquidez, precio, volumen }) {
  if (liquidez < 1000) return 'MUERTO';
  if (liquidez < 10000) return 'RIESGO';
  if (volumen < 500) return 'BAJO_MOVIMIENTO';
  return 'SALUDABLE';
}

// ----------------------
// FETCH SEGURO
// ----------------------

async function fetchSeguro(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();

  } finally {
    clearTimeout(timeout);
  }
}

// ----------------------
// FUNCIÓN PRINCIPAL
// ----------------------

async function obtenerDatosToken() {
  try {
    const data = await fetchSeguro(
      `https://api.dexscreener.com/latest/dex/tokens/${MINT_DMR4}`
    );

    if (!data || !Array.isArray(data.pairs)) {
      return { error: 'Respuesta inválida' };
    }

    const pair = data.pairs.find(p => p.chainId === 'solana');

    if (!pair) {
      return { error: 'Sin pool activo' };
    }

    const resultado = {
      liquidez: pair.liquidity?.usd || 0,
      precio: Number(pair.priceUsd) || 0,
      volumen: pair.volume?.h24 || 0
    };

    // 🧠 DECISIÓN AUTOMÁTICA
    const estado = evaluarToken(resultado);

    return {
      ...resultado,
      estado
    };

  } catch (error) {
    return {
      error: 'Error de red',
      detalle: error.message
    };
  }
}

module.exports = { obtenerDatosToken };
