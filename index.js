require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });
const RUTA_BASE = '/data/data/com.termux/files/home/proyectos-dmr4';

async function modoCopilot() {
    console.log("🤖 IA-DMR4: Modo Copilot Activo. Analizando código...");
    let informe = `🚀 *COPILOT DMR4: ANÁLISIS DE CÓDIGO*\n\n`;

    const repos = ["Agro-Tech-Dmr4-IA", "MotoTech-DMR4", "dmr4-token-web"];

    for (const repo of repos) {
        const rutaArchivo = path.join(RUTA_BASE, repo, 'server.js');

        if (fs.existsSync(rutaArchivo)) {
            const codigo = fs.readFileSync(rutaArchivo, 'utf8');
            
            // --- RASTREADOR DE ERRORES (Lógica Copilot) ---
            let erroresEncontrados = [];

            if (codigo.includes('process.env') && !codigo.includes("require('dotenv')")) {
                erroresEncontrados.push("Falta require('dotenv') para leer tus llaves.");
            }
            if (codigo.includes('app.get') && !codigo.includes("express")) {
                erroresEncontrados.push("Usa funciones de Express sin haberlo definido.");
            }
            if (codigo.match(/(const|let|var)\s+\w+\s*=\s*require/g) === null && codigo.includes('require')) {
                erroresEncontrados.push("Posible error en la importación de módulos.");
            }

            // --- REPORTE AL TELEGRAM ---
            if (erroresEncontrados.length > 0) {
                informe += `⚠️ *${repo}*:\n`;
                erroresEncontrados.forEach(err => informe += `- ${err}\n`);
                informe += `💡 *Sugerencia:* Revisa el encabezado de tu server.js\n\n`;
            } else {
                informe += `✅ *${repo}*: Código limpio y optimizado.\n`;
            }
        }
    }

    bot.sendMessage(process.env.TELEGRAM_CHAT_ID, informe, { parse_mode: 'Markdown' });
}

modoCopilot();

