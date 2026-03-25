const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function ejecutarAuditoria() {
    try {
        let contextoDMR4 = "";
        if (fs.existsSync("./data.json")) {
            const data = fs.readFileSync("./data.json", "utf8");
            contextoDMR4 = `\nBase de Datos Proyectos:\n${data}`;
        }

        // Probamos con el modelo Pro que es el más estable para la API v1
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        const prompt = `Eres la IA DMR4 de Dentalmovilr4. Realiza una auditoría rápida de seguridad basada en este contexto:${contextoDMR4}\nResponde de forma técnica y breve para Telegram.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textoReporte = response.text();

        const urlTG = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        await axios.post(urlTG, {
            chat_id: TG_CHAT_ID,
            text: `🛡️ **REPORTE IA DMR4** 🛡️\n\n${textoReporte}`,
            parse_mode: "Markdown"
        });

        console.log("✅ Auditoría completada con éxito.");

    } catch (error) {
        console.error("❌ Error detectado:", error.message);
        
        // Si falla el Pro, enviamos el aviso para ajustar al modelo base
        if (TG_TOKEN && TG_CHAT_ID) {
            const urlTG = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
            await axios.post(urlTG, {
                chat_id: TG_CHAT_ID,
                text: `⚠️ **AVISO IA DMR4**: Reintentando conexión con modelo alternativo...`
            }).catch(() => {});
        }
        
        // Reintento con el modelo estándar por si el Pro no está disponible en tu zona de API
        try {
            const modelFlash = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await modelFlash.generateContent("DMR4: Reporte de emergencia. El sistema está activo.");
            const response = await result.response;
            const urlTG = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
            await axios.post(urlTG, {
                chat_id: TG_CHAT_ID,
                text: `🛡️ **REPORTE EMERGENCIA DMR4** 🛡️\n\n${response.text()}`
            });
        } catch (innerError) {
            process.exit(1);
        }
    }
}

ejecutarAuditoria();


