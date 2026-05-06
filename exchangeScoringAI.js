require('dotenv').config();
const Redis = require('ioredis');
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

/**
 * IA-DMR4: Exchange Scoring AI
 * Motor de calificación de mercados basado en métricas de rendimiento.
 */

// Pesos iniciales de la red (Neurona de calificación)
let weights = {
  latency: -0.4, // A mayor latencia, menor puntaje
  volume: 0.5,   // A mayor volumen, mayor puntaje
  spread: -0.3   // A mayor spread, menor puntaje
};

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

async function calculateScore(exchangeData) {
  const { latency, volume, spread } = exchangeData;

  // Normalización básica y cálculo del score (Suma ponderada)
  const z = (latency * weights.latency) + 
            (Math.log10(volume) * weights.volume) + 
            (spread * weights.spread);

  const score = sigmoid(z);
  return score;
}

async function runScoring() {
  console.log("🧠 IA-DMR4: Exchange Scoring AI activo...");

  setInterval(async () => {
    try {
      // Obtenemos los mercados descubiertos por el módulo Discovery
      const markets = JSON.parse(await redis.get('discovery:markets') || '[]');
      
      let scoredMarkets = [];

      for (let m of markets) {
        const score = await calculateScore(m);
        scoredMarkets.push({ ...m, score: score.toFixed(4) });
      }

      // Ordenar por mejor puntuación
      scoredMarkets.sort((a, b) => b.score - a.score);

      // Guardar el ranking en Redis para el optimizador
      await redis.set('ai:exchange:scores', JSON.stringify(scoredMarkets));
      
      if (scoredMarkets.length > 0) {
        console.log(`✅ AI: Top Exchange calificado -> ${scoredMarkets[0].name} (Score: ${scoredMarkets[0].score})`);
      }

    } catch (error) {
      console.error("❌ Error en Scoring AI:", error.message);
    }
  }, 12000); // Ejecución cada 12 segundos
}

runScoring();
