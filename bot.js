require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;

// ----------------------
// VALIDACIÓN
// ----------------------

if (!token) {
  console.error("❌ ERROR: TELEGRAM_TOKEN no definido");
  process.exit(1);
}

if (!chatId) {
  console.warn("⚠️ CHAT_ID no definido (no se podrán enviar mensajes automáticos)");
}

// polling false → modo backend
const bot = new TelegramBot(token, { polling: false });

console.log("🤖 Bot DMR4 listo para envíos");

// ----------------------
// UTILIDADES
// ----------------------

async function enviarMensaje(texto) {
  if (!chatId) return;

  try {
    // Telegram límite 4096 chars
    const partes = texto.match(/[\s\S]{1,4000}/g) || [texto];

    for (const parte of partes) {
      await bot.sendMessage(chatId, parte, { parse_mode: 'HTML' });
    }

  } catch (err) {
    console.error("❌ Error enviando mensaje:", err.message);
  }
}

// ----------------------
// ALERTAS INTELIGENTES
// ----------------------

async function alerta(tipo, mensaje) {
  const iconos = {
    error: "❌",
    warning: "⚠️",
    success: "✅",
    info: "ℹ️",
    money: "💰"
  };

  const icono = iconos[tipo] || "🤖";

  const texto = `
${icono} <b>DMR4 ALERTA</b>

${mensaje}
  `;

  await enviarMensaje(texto);
}

// ----------------------
// LOG REMOTO
// ----------------------

async function logSistema(msg) {
  const texto = `📊 <b>LOG DMR4</b>\n\n${msg}`;
  await enviarMensaje(texto);
}

// ----------------------

module.exports = {
  bot,
  chatId,
  enviarMensaje,
  alerta,
  logSistema
};
