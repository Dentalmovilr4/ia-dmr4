const { MINT_DMR4 } = require('./config');

async function obtenerDatosToken() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MINT_DMR4}`, { signal: controller.signal });
    const data = await response.json();
    const pair = (data.pairs || []).find(p => p.chainId === 'solana');
    
    return pair ? {
      liquidez: pair.liquidity?.usd || 0,
      precio: pair.priceUsd || 0,
      volumen: pair.volume?.h24 || 0
    } : { error: 'Sin pool activo' };
  } catch (error) {
    return { error: 'Error de red' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { obtenerDatosToken };
