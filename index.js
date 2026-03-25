const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");

// Configuración de Identidad y Seguridad
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Usamos gemini-1.5-flash: es rápido, estable y consume menos créditos
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function ejecutarAuditoria() {
    try {
        // 1. Cargar base de datos local
        const dataPath = "./data.json";
        let contextData = "Sin datos previos";
        
        if (fs.existsSync(dataPath)) {
            contextData = fs.readFileSync(dataPath, "utf8");
        }

        // 2. Generar el reporte de seguridad
        const prompt = `Eres la IA DMR4. Contexto del ecosistema: ${contextData}. 
        Realiza una auditoría de seguridad para los repositorios de Dentalmovil. 
        Detecta riesgos de exposición de llaves o ubicación. Sé técnico y breve.`;

        const result = await model.generateContent(prompt);
        const reportText = result.response.text();

        // 3. Enviar a Telegram
        const TG_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
        
        await axios.post(TG_URL, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: `🛡️ **REPORTE DE SEGURIDAD DMR4** 🛡️\n\n${reportText}`,
            parse_mode: "Markdown"
        });

        console.log("✅ Auditoría completada y enviada.");

    } catch (error) {
        // Manejo de errores específico para no quemar créditos
        console.error("❌ Error en la ejecución:", error.message);
        
        if (process.env.TELEGRAM_TOKEN) {
            const errorMsg = error.message.includes("429") 
                ? "⚠️ Créditos agotados o límite de cuota alcanzado." 
                : `⚠️ Error DMR4: ${error.message}`;

            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: errorMsg
            }).catch(() => {});
        }
        process.exit(1); // Cerramos el proceso con error para que GitHub marque la X
    }
}

ejecutarAuditoria();


