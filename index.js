const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 🔁 MODELOS DISPONIBLES
const modelos = [
    "gemini-1.5-flash",
    "gemini-1.0-pro"
];

// 🧠 GENERADOR CON FALLBACK
async function generarConFallback(prompt) {
    for (const modelo of modelos) {
        try {
            const model = genAI.getGenerativeModel({ model: modelo });
            const result = await model.generateContent(prompt);
            const texto = result.response.text();

            console.log("✅ Modelo usado:", modelo);
            return { texto, modelo };

        } catch (error) {
            console.log("❌ Falló modelo:", modelo);
        }
    }
    throw new Error("Todos los modelos fallaron");
}

// 🔁 REINTENTOS AUTOMÁTICOS
async function conReintento(fn, intentos = 3) {
    for (let i = 0; i < intentos; i++) {
        try {
            return await fn();
        } catch (e) {
            console.log(`⚠️ Reintento ${i + 1}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw new Error("Falló después de varios intentos");
}

// 📊 SCORING DE RIESGO
function calcularRiesgo(texto) {
    let score = 0;
    const t = texto.toLowerCase();

    if (t.includes("crítico")) score += 40;
    if (t.includes("alto")) score += 30;
    if (t.includes("medio")) score += 20;
    if (t.includes("bajo")) score += 10;

    return Math.min(score, 100);
}

async function ejecutar() {
    try {
        // 📁 Leer data.json
        let context = "";
        if (fs.existsSync("./data.json")) {
            context = fs.readFileSync("./data.json", "utf8");
        }

        // 🧠 Prompt mejorado
        const prompt = `
Eres la IA DMR4 especializada en auditoría.

Analiza:
${context}

Genera:
- Riesgos
- Nivel (alto, medio, bajo)
- Recomendaciones
- Resumen breve
`;

        // 🔥 IA con protección total
        const { texto, modelo } = await conReintento(() =>
            generarConFallback(prompt)
        );

        const score = calcularRiesgo(texto);

        // 📩 Mensaje final
        const mensaje = `
🛡️ DMR4 REPORTE

📊 Riesgo: ${score}/100
🤖 Modelo: ${modelo}

${texto}
`;

        // 📡 Enviar a Telegram (SIN markdown para evitar errores)
        await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            chat_id: TG_CHAT_ID,
            text: mensaje
        });

        console.log("✅ Reporte enviado");

    } catch (err) {
        console.error("❌ Error:", err);

        await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            chat_id: TG_CHAT_ID,
            text: `⚠️ DMR4 Offline:\n${err.message}`
        }).catch(() => {});

        process.exit(1);
    }
}

ejecutar();
