require('dotenv').config();
const Redis = require('ioredis');
const math = require('mathjs');

const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

// Configuración desde el .env
const WINDOW = parseInt(process.env.WINDOW || 20);
const RISK_AVERSION = parseFloat(process.env.RISK_AVERSION || 1.0);
const MIN_W = parseFloat(process.env.MIN_WEIGHT || 0.05);
const MAX_W = parseFloat(process.env.MAX_WEIGHT || 0.6);

// --- Funciones Matemáticas ---
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function covariance(a, b) {
  const ma = mean(a);
  const mb = mean(b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - ma) * (b[i] - mb);
  }
  return sum / a.length;
}

function buildMatrices(data) {
  const assets = Object.keys(data);
  const returns = assets.map(a => data[a].slice(-WINDOW));
  const mu = returns.map(r => mean(r));
  const cov = returns.map(r1 => returns.map(r2 => covariance(r1, r2)));
  return { assets, mu, cov };
}

// --- Optimizador de Media-Varianza ---
function optimize(mu, cov) {
  const n = mu.length;
  try {
    const invCov = math.inv(cov);
    const ones = Array(n).fill(1);

    const A = math.multiply(ones, math.multiply(invCov, ones));
    const B = math.multiply(ones, math.multiply(invCov, mu));
    const C = math.multiply(mu, math.multiply(invCov, mu));

    const lambda = (C - RISK_AVERSION * B) / (A * C - B * B);
    const gamma = (RISK_AVERSION * A - B) / (A * C - B * B);

    let w = math.add(
      math.multiply(lambda, math.multiply(invCov, ones)),
      math.multiply(gamma, math.multiply(invCov, mu))
    );

    return w.toArray();
  } catch (e) {
    console.error("⚠️ Error matemático, usando pesos iguales:", e.message);
    return Array(n).fill(1 / n);
  }
}

function normalizeClamp(w) {
  let total = 0;
  w = w.map(x => {
    let v = Math.max(MIN_W, Math.min(MAX_W, x));
    total += v;
    return v;
  });
  return w.map(x => x / total);
}

// --- Ciclo Principal ---
async function loop() {
  const data = JSON.parse(await redis.get('returns:data') || '{}');
  const keys = Object.keys(data);

  if (keys.length < 2) {
    console.log("📊 Optimizer: Esperando más datos de activos...");
    return;
  }

  const { assets, mu, cov } = buildMatrices(data);
  let weights = optimize(mu, cov);
  weights = normalizeClamp(weights);

  const portfolio = assets.map((a, i) => ({
    asset: a,
    weight: weights[i]
  }));

  console.log("\n📊 IA-DMR4: PORTFOLIO OPTIMO");
  portfolio.forEach(p => {
    console.log(`${p.asset} → ${(p.weight * 100).toFixed(2)}%`);
  });

  await redis.set('portfolio:weights', JSON.stringify(portfolio));
}

console.log("📊 IA-DMR4: Portfolio Optimizer activo...");
setInterval(loop, 15000);
