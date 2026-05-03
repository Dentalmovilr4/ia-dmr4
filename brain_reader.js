require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs/promises');
const path = require('path');

const manager = require('./processManager');
const { obtenerDatosToken } = require('./dex');

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const BRAIN_PATH = path.join(__dirname, 'brain');

console.log("🧠 Cerebro DMR4 activo...");

// ----------------------
// UTILIDAD
// ----------------------

async function leerArchivo(ruta) {
  try {
    return await fs.readFile(ruta, 'utf8');
  } catch {
    return "⚠️ No se encontró información.";
  }
}

// ----------------------
// CONSULTAR CONOCIMIENTO
// ----------------------

bot.onText(/\/consultar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tema = match[1].toLowerCase();

  const rutas = {
    agro: 'agro/suelos_cesar.md',
    suelos: 'agro/suelos_cesar.md',
    crypto: 'crypto/solana_tips.md',
    solana: 'crypto/solana_tips.md',
    dmr4: 'crypto/solana_tips.md'
  };

  if (!rutas[tema]) {
    return bot.sendMessage(chatId, "❌ Tema no encontrado.");
  }

  const contenido = await leerArchivo(path.join(BRAIN_PATH, rutas[tema]));

  bot.sendMessage(chatId, `📖 *DMR4 dice:*\n\n${contenido}`, {
    parse_mode: 'Markdown'
  });
});

// ----------------------
// CONTROL DE PROCESOS
// ----------------------

bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const repo = match[1];

  const res = await manager.iniciar(repo);

  bot.sendMessage(chatId, `🚀 ${repo}: ${JSON.stringify(res)}`);
});

bot.onText(/\/stop (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const repo = match[1];

  const res = await manager.detener(repo);

  bot.sendMessage(chatId, `🛑 ${repo}: ${JSON.stringify(res)}`);
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;

  const procesos = manager.getProcesos();

  let texto = "📊 *Estado del sistema:*\n\n";

  for (const [repo, info] of Object.entries(procesos)) {
    texto += `📁 ${repo} → PID: ${info.pid} | PORT: ${info.port}\n`;
  }

  if (texto === "📊 *Estado del sistema:*\n\n") {
    texto += "Sin procesos activos.";
  }

  bot.sendMessage(chatId, texto, { parse_mode: 'Markdown' });
});

// ----------------------
// ESTADO DEL TOKEN (DEX)
// ----------------------

bot.onText(/\/token/, async (msg) => {
  const chatId = msg.chat.id;

  const data = await obtenerDatosToken();

  if (data.error) {
    return bot.sendMessage(chatId, `❌ ${data.error}`);
  }

  const msgTxt = `
💰 *DMR4 TOKEN*
Precio: $${data.precio}
Liquidez: $${data.liquidez}
Volumen: $${data.volumen}
Estado: ${data.estado}
  `;

  bot.sendMessage(chatId, msgTxt, { parse_mode: 'Markdown' });
});

// ----------------------
// COMANDO INTELIGENTE
// ----------------------

bot.onText(/\/decision/, async (msg) => {
  const chatId = msg.chat.id;

  const token = await obtenerDatosToken();

  if (token.estado === 'MUERTO') {
    await manager.detener('dmr4-token-web');
    return bot.sendMessage(chatId, "🛑 Token muerto → sistema detenido");
  }

  if (token.estado === 'SALUDABLE') {
    await manager.iniciar('dmr4-token-web');
    return bot.sendMessage(chatId, "🚀 Token activo → sistema iniciado");
  }

  bot.sendMessage(chatId, "⚠️ Estado intermedio, sin acción");
});
