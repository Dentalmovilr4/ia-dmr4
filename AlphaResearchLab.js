require('dotenv').config();
const Redis = require('ioredis');
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

/**
 * IA-DMR4: Alpha Research Lab
 * Laboratorio de aprendizaje automático y descubrimiento de estrategias.
 */

const WINDOW = parseInt(process.env.WINDOW || 1000);
const SPLIT = parseFloat(process.env.TRAIN_SPLIT || 0.7);
const TH = parseFloat(process.env.THRESHOLD || 0.55);

// --- Modelado Simple (Regresión Logística) ---
let weights = [0, 0, 0, 0]; // r1, r5, spread, vol

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function predict(x) {
  return sigmoid(weights.reduce((a, wi, i) => a + wi * x[i], 0));
}

function train(X, y, lr = 0.01, epochs = 5) {
  for (let e = 0; e < epochs; e++) {
    for (let i = 0; i < X.length; i++) {
      const p = predict(X[i]);
      const err = y[i] - p;
      weights = weights.map((wi, j) => wi + lr * err * X[i][j]);
    }
  }
}

// --- Ingeniería de Características (Features) ---
function getFeatures(data) {
  const X = [];
  const y = [];
  for (let i = 5; i < data.length - 1; i++) {
    const r1 = (data[i].price - data[i-1].price) / data[i-1].price;
    const r5 = (data[i].price - data[i-5].price) / data[i-5].price;
    const spread = (data[i].ask - data[i].bid) / (data[i].bid || 1);
    const vol = data[i].volume;
    
    const target = data[i+1].price > data[i].price ? 1 : 0;
    X.push([r1, r5, spread, vol]);
    y.push(target);
  }
  return { X, y };
}

async function loop() {
  try {
    const rawData = JSON.parse(await redis.get('market:data') || '[]');
    if (rawData.length < 50) return;

    const { X, y } = getFeatures(rawData.slice(-WINDOW));
    const splitIdx = Math.floor(X.length * SPLIT);

    const Xtrain = X.slice(0, splitIdx);
    const ytrain = y.slice(0, splitIdx);
    const Xtest = X.slice(splitIdx);
    const ytest = y.slice(splitIdx);

    train(Xtrain, ytrain);

    // Backtest del modelo entrenado
    let wins = 0;
    for (let i = 0; i < Xtest.length; i++) {
      const p = predict(Xtest[i]);
      const actual = ytest[i];
      if ((p > 0.5 && actual === 1) || (p <= 0.5 && actual === 0)) wins++;
    }

    const acc = wins / Xtest.length;
    console.log(`\n🧪 IA-DMR4 ALPHA LAB: Accuracy: ${(acc * 100).toFixed(2)}%`);

    if (acc > TH) {
      console.log("🔥 ¡NUEVO ALPHA ENCONTRADO! Guardando pesos...");
      await redis.set('alpha:best', JSON.stringify({
        weights,
        accuracy: acc,
        timestamp: Date.now()
      }));
    }

  } catch (error) {
    console.error("❌ Error en Alpha Lab:", error.message);
  }
}

console.log("🧪 IA-DMR4: Alpha Research Lab activo y analizando patrones...");
setInterval(loop, 15000);
