const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Ruta hacia tu cerebro digital
const BRAIN_PATH = path.join(__dirname, 'brain');

console.log("🧠 Cerebro DMR4 conectado y escuchando...");

bot.onText(/\/consultar (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const tema = match[1].toLowerCase(); // Ejemplo: "agro" o "crypto"

    try {
        // Mapeo de temas a archivos específicos
        const carpetas = {
            'agro': 'agro/suelos_cesar.md',
            'suelos': 'agro/suelos_cesar.md',
            'crypto': 'crypto/solana_tips.md',
            'solana': 'crypto/solana_tips.md',
            'dmr4': 'crypto/solana_tips.md'
        };

        if (carpetas[tema]) {
            const rutaArchivo = path.join(BRAIN_PATH, carpetas[tema]);
            const contenido = await fs.readFile(rutaArchivo, 'utf8');
            
            await bot.sendMessage(chatId, `📖 *Información del Cerebro DMR4:*\n\n${contenido}`, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, "❌ No encontré información sobre ese tema. Prueba con: agro, suelos, crypto o solana.");
        }
    } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, "⚠️ Error al acceder al cerebro técnico.");
    }
});
