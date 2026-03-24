const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios"); // Asegúrate de tener axios en tu package.json

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuración de Telegram (Añade estos a tus Secrets en Replit)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function enviarReporteTelegram(mensaje) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: CHAT_ID,
      text: `🛡️ **REPORTE IA DMR4**\n━━━━━━━━━━━━━━━━━━━━\n${mensaje}`,
      parse_mode: "Markdown"
    });
    console.log("✅ Reporte enviado a Aura Trade AI");
  } catch (error) {
    console.error("❌ Error al enviar a Telegram:", error.message);
  }
}

async function iniciarIA() {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "Eres IA DMR4, experto en ciberseguridad. Genera reportes concisos para Telegram."
  });
  
  const prompt = process.argv.slice(2).join(" ");
  if (!prompt) return;

  try {
    const result = await model.generateContent(prompt);
    const respuestaIA = result.response.text();

    // Mostramos en consola y ENVIAMOS A TELEGRAM
    console.log(respuestaIA);
    await enviarReporteTelegram(respuestaIA);

  } catch (error) {
    await enviarReporteTelegram("⚠️ Error crítico en el motor de IA DMR4.");
  }
}

iniciarIA();


