require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs/promises');
const path = require('path');
const manager = require('./processManager'); // 🔥 integración clave

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const HOME_DIR = '/data/data/com.termux/files/home';
const DATA_FILE = path.join(HOME_DIR, 'ia-dmr4', 'data.json');

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.cache'];

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ Configura TOKEN y CHAT_ID');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ----------------------
// UTILIDADES
// ----------------------

const escapeHtml = (str) =>
  str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[m]));

async function obtenerArchivosJS(dir, lista = []) {
  try {
    const entradas = await fs.readdir(dir, { withFileTypes: true });

    for (const entrada of entradas) {
      const ruta = path.join(dir, entrada.name);

      if (entrada.isDirectory()) {
        if (!IGNORE_DIRS.includes(entrada.name)) {
          await obtenerArchivosJS(ruta, lista);
        }
      } else if (entrada.name.endsWith('.js')) {
        lista.push(ruta);
      }
    }
  } catch {}

  return lista;
}

// ----------------------
// MOTOR INTELIGENTE
// ----------------------

function analizarContenido(codigo) {
  const res = { errores: [], sugerencias: [], criticidad: 0 };

  if (/(password|secret|token|key)\s*=\s*['"][^'"]{8,}/i.test(codigo)) {
    res.errores.push("🔒 Secreto expuesto");
    res.criticidad += 20;
  }

  if (codigo.includes('express()') && !codigo.includes('helmet')) {
    res.sugerencias.push("🛡️ Falta helmet");
    res.criticidad += 3;
  }

  if (codigo.includes('${req.body') || codigo.includes('${req.query')) {
    res.errores.push("🚨 Riesgo de inyección");
    res.criticidad += 25;
  }

  if (/\bvar\s+\w+/.test(codigo)) {
    res.sugerencias.push("💡 Usa const/let");
  }

  return res;
}

// ----------------------
// DECISIÓN AUTOMÁTICA
// ----------------------

function evaluarProyecto(resultados) {
  const totalCrit = resultados.reduce((a, r) => a + r.criticidad, 0);

  if (totalCrit > 50) return 'CRITICO';
  if (totalCrit > 20) return 'RIESGO';
  return 'OK';
}

// ----------------------
// AUDITORÍA
// ----------------------

async function ejecutarAuditoria() {
  console.log('🔍 Auditoría inteligente iniciada...');

  const resultados = [];
  const decisiones = [];

  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const repos = JSON.parse(raw);

    for (const repo of repos) {
      const ruta = path.join(HOME_DIR, repo);
      const archivos = await obtenerArchivosJS(ruta);

      const analisisRepo = [];

      for (const file of archivos) {
        const contenido = await fs.readFile(file, 'utf8');
        const analisis = analizarContenido(contenido);

        if (analisis.criticidad > 0) {
          analisisRepo.push(analisis);
        }
      }

      const estado = evaluarProyecto(analisisRepo);

      // 🔥 DECISIÓN REAL
      if (estado === 'CRITICO') {
        await manager.detener(repo);
        decisiones.push(`🛑 ${repo} detenido automáticamente`);
      }

      if (estado === 'RIESGO') {
        decisiones.push(`⚠️ ${repo} requiere revisión`);
      }

      if (estado === 'OK') {
        decisiones.push(`✅ ${repo} estable`);
      }

      resultados.push({ repo, estado, total: analisisRepo.length });
    }

    await enviarInforme(resultados, decisiones);

  } catch (err) {
    console.error(err.message);
  }
}

// ----------------------
// TELEGRAM
// ----------------------

async function enviarInforme(resultados, decisiones) {
  let msg = `<b>🧠 IA-DMR4 AUTÓNOMA</b>\n\n`;

  for (const r of resultados) {
    msg += `📁 <b>${escapeHtml(r.repo)}</b> → ${r.estado}\n`;
  }

  msg += `\n<b>⚙️ DECISIONES:</b>\n`;
  decisiones.forEach(d => msg += `${d}\n`);

  const chunks = msg.match(/[\s\S]{1,4000}/g) || [msg];

  for (const c of chunks) {
    await bot.sendMessage(TELEGRAM_CHAT_ID, c, { parse_mode: 'HTML' });
  }
}

// ----------------------
// EJECUCIÓN
// ----------------------

(async () => {
  await manager.inicializar(); // 🔥 importante
  await ejecutarAuditoria();
})();
