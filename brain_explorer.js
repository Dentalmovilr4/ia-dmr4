require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs/promises');
const path = require('path');

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const BRAIN_PATH = path.join(__dirname, 'brain');

console.log("🧠 Explorador inteligente DMR4 activo...");

// ----------------------
// SEGURIDAD
// ----------------------

function rutaSegura(cat, file) {
  if (!/^[a-z0-9_-]+$/i.test(cat)) return null;
  if (!/^[a-z0-9_-]+$/i.test(file)) return null;

  const ruta = path.resolve(BRAIN_PATH, cat, `${file}.md`);

  if (!ruta.startsWith(path.resolve(BRAIN_PATH))) return null;

  return ruta;
}

// ----------------------
// LISTAR TEMAS
// ----------------------

bot.onText(/\/brain/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const categorias = await fs.readdir(BRAIN_PATH);
    let respuesta = "🧠 *Cerebro DMR4:*\n\n";

    for (const cat of categorias) {
      const archivos = await fs.readdir(path.join(BRAIN_PATH, cat));
      const temas = archivos.map(a => a.replace('.md', '')).join(', ');
      respuesta += `📁 *${cat}*: ${temas}\n`;
    }

    bot.sendMessage(chatId, respuesta, { parse_mode: 'Markdown' });

  } catch {
    bot.sendMessage(chatId, "⚠️ No se pudo leer el cerebro.");
  }
});

// ----------------------
// LEER ARCHIVO
// ----------------------

bot.onText(/\/leer (\w+) (\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ruta = rutaSegura(match[1], match[2]);

  if (!ruta) {
    return bot.sendMessage(chatId, "❌ Ruta inválida.");
  }

  try {
    let contenido = await fs.readFile(ruta, 'utf8');

    // Limitar tamaño (Telegram tiene límite)
    if (contenido.length > 3500) {
      contenido = contenido.slice(0, 3500) + "\n\n... (resumen)";
    }

    bot.sendMessage(chatId, `📖 ${match[2]}:\n\n${contenido}`, {
      parse_mode: 'Markdown'
    });

  } catch {
    bot.sendMessage(chatId, "❌ No se encontró el archivo.");
  }
});

// ----------------------
// 🔍 BUSCADOR INTELIGENTE
// ----------------------

bot.onText(/\/buscar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1].toLowerCase();

  let resultados = [];

  try {
    const categorias = await fs.readdir(BRAIN_PATH);

    for (const cat of categorias) {
      const archivos = await fs.readdir(path.join(BRAIN_PATH, cat));

      for (const file of archivos) {
        const ruta = path.join(BRAIN_PATH, cat, file);
        const contenido = await fs.readFile(ruta, 'utf8');

        if (contenido.toLowerCase().includes(query)) {
          resultados.push(`${cat}/${file.replace('.md', '')}`);
        }
      }
    }

    if (resultados.length === 0) {
      return bot.sendMessage(chatId, "❌ No encontré resultados.");
    }

    bot.sendMessage(chatId,
      `🔍 Resultados:\n\n${resultados.join('\n')}`
    );

  } catch {
    bot.sendMessage(chatId, "⚠️ Error en búsqueda.");
  }
});
