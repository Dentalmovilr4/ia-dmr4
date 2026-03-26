const axios = require("axios");
const fs = require("fs");

async function ejecutarAuditoria() {
    const apiKey = process.env.GEMINI_API_KEY;
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    let dataContext = "Sin datos previos de proyectos.";
    if (fs.existsSync("./data.json")) {
        try {
            dataContext = fs.readFileSync("./data.json", "utf8");
        } catch (e) {
            console.log("No se pudo leer data.json");
        }
    }

    console.log("🚀 Iniciando Auditoría Directa DMR4 (v1beta)...");

    try {
        // 2. LA RUTA MAESTRA (v1beta)
        // Esta ruta es la que acepta gemini-1.5-flash en la mayoría de proyectos nuevos
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [{ text: `Actúa como IA DMR4 de Dentalmovilr4. Analiza estos datos y detecta riesgos: ${dataContext}. Responde de forma técnica y breve.` }]
            }]
        };

        const response = await axios.post(url, payload);
        const report = response.data.candidates[0].content.parts[0].text;

        // 3. ENVIAR REPORTE A TELEGRAM
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **DMR4 ONLINE: REPORTE DE AUDITORÍA** 🛡️\n\n${report}`,
            parse_mode: "Markdown"
        });

        console.log("✅ ¡POR FIN! Reporte enviado.");

    } catch (error) {
        console.error("❌ Error detectado:");
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.log(errorMsg);

        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4 CRITICAL FAIL**\nMotivo: ${errorMsg}`,
            parse_mode: "Markdown"
        }).catch(() => {});
        
        process.exit(1);
    }
}

ejecutarAuditoria();

