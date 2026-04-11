require('dotenv').config(); // Esto jala la clave del .env
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;

// Verificación de seguridad hacker
if (!token) {
    console.error("❌ ERROR: No encontré el Token en el archivo .env");
    process.exit(1);
}

const bot = new TelegramBot(token, {polling: true});
console.log("🚀 Bot de IA-DMR4 conectado usando .env...");

