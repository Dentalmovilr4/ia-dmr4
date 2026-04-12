const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Ruta hacia tu cerebro digital
const BRAIN_PATH = path.join(__dirname, 'brain');

console.log("🚀 Explorador DMR4 iniciado. Escaneando cerebro...");

// Comando para listar todos los temas disponibles
bot.onText(/\/brain/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const categorias = await fs.readdir(BRAIN_PATH);
        let respuesta = "🧠 *Temas disponibles en el Cerebro DMR4:*\n\n";
        
        for (const cat of categorias) {
            const archivos = await fs.readdir(path.join(BRAIN_PATH, cat));
            const temas = archivos.map(a => a.replace('.md', '')).join(', ');
            respuesta += `📁 *${cat.toUpperCase()}*: ${temas}\n`;
        }
        
        respuesta += "\nUsa `/leer [categoría] [archivo]` para ver el contenido.";
        bot.sendMessage(chatId, respuesta, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, "⚠️ El cerebro está vacío o no se encuentra la carpeta.");
    }
});

// Comando para leer un archivo específico
bot.onText(/\/leer (\w+) (\w+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const cat = match[1].toLowerCase();
    const file = match[2].toLowerCase();
    const rutaFinal = path.join(BRAIN_PATH, cat, `${file}.md`);

    try {
        const contenido = await fs.readFile(rutaFinal, 'utf8');
        bot.sendMessage(chatId, `📖 *DMR4 Wiki - ${file.toUpperCase()}*\n\n${contenido}`, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, "❌ No encontré ese archivo. Revisa que la categoría y el nombre estén bien.");
    }
});
