const axios = require("axios");
const fs = require("fs");

async function ejecutarAuditoria() {
    const apiKey = process.env.GEMINI_API_KEY;
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // 1. Cargar datos locales
    let dataContext = "Sin datos previos";
    if (fs.existsSync("./data.json")) {
        dataContext = fs.readFileSync("./data.json", "utf8");
    }

    console.log("🚀 Iniciando Auditoría Directa DMR4...");

    try {
        // 2. Conexión Directa a Gemini 1.5 Flash (Ruta estable v1)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [{ text: `Actúa como IA DMR4. Analiza estos datos: ${dataContext}. Detecta riesgos de seguridad en repositorios de Dentalmovilr4. Sé breve.` }]
            }]
        };

        const response = await axios.post(url, payload);
        const report = response.data.candidates[0].content.parts[0].text;

        // 3. Enviar a Telegram
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **REPORTE DMR4 ONLINE** 🛡️\n\n${report}`,
            parse_mode: "Markdown"
        });

        console.log("✅ ¡ÉXITO! Reporte enviado.");

    } catch (error) {
        console.error("❌ Error:");
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.log(errorMsg);

        // Notificar fallo a Telegram
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4 CRITICAL FAIL**\nError: ${error.message}`
        }).catch(() => {});
        
        process.exit(1);
    }
}

ejecutarAuditoria();

