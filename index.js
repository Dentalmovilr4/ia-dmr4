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
            console.log("Error leyendo data.json");
        }
    }

    // LISTA DE MODELOS ACTUALIZADA SEGÚN TU CAPTURA
    const modelosDMR4 = ["gemini-3-flash", "gemini-3-pro", "gemini-1.5-flash"];
    let reporteGenerado = null;
    let modeloExitoso = "";

    console.log("🚀 Iniciando Auditoría con Generación 3...");

    // AQUÍ ESTÁ LA CORRECCIÓN: usamos 'of' en lugar de 'de'
    for (const modelo of modelosDMR4) {
        try {
            console.log(`Probando modelo: ${modelo}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{
                    parts: [{ text: `Actúa como IA DMR4 de Dentalmovilr4. Analiza estos datos y detecta riesgos: ${dataContext}. Sé breve y técnico.` }]
                }]
            };

            const response = await axios.post(url, payload);
            
            if (response.data && response.data.candidates) {
                reporteGenerado = response.data.candidates[0].content.parts[0].text;
                modeloExitoso = modelo;
                console.log(`✅ ¡Dominada con ${modelo}!`);
                break; 
            }
        } catch (error) {
            const msg = error.response ? error.response.data.error.message : error.message;
            console.log(`❌ ${modelo} falló: ${msg}`);
        }
    }

    if (reporteGenerado) {
        // ENVIAR REPORTE EXITOSO
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `🛡️ **DMR4 ONLINE: REPORTE G3** 🛡️\n\n**Modelo:** ${modeloExitoso}\n\n${reporteGenerado}`,
            parse_mode: "Markdown"
        });
        console.log("🚀 Reporte enviado a Telegram con éxito.");
    } else {
        // AVISO DE FALLO TOTAL
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            chat_id: chatId,
            text: `⚠️ **DMR4 CRITICAL FAIL**\nNingún modelo de la serie Gemini 3 o 1.5 respondió. Revisa la consola de GitHub.`
        });
        process.exit(1);
    }
}

ejecutarAuditoria();

