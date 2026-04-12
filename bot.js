require('dotenv').config(); // Esto jala la clave >
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;

// Verificación de seguridad hacker
if (!token) {
  console.error("❌ ERROR: No encontré el Token >");
  process.exit(1);
}

// CORRECCIÓN CRÍTICA: polling en false para evitar el error 409
const bot = new TelegramBot(token, {polling: false});
console.log("🚀 Bot de IA-DMR4 configurado para envíos directos");

// Exportamos el bot para usarlo en otros archivos si es necesario
module.exports = { bot, chatId };

