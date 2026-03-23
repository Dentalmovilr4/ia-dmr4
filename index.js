const { GoogleGenerativeAI } = require("@google/generative-ai");

// Configuración de la llave desde el entorno de Replit
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function iniciarIA() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // Toma tu pregunta desde la consola
  const prompt = process.argv.slice(2).join(" ");

  if (!prompt) {
    console.log("\n🛸 [IA DMR4]: Esperando instrucciones, colega. Ejemplo: node index.js 'analiza mi codigo'");
    return;
  }

  try {
    const result = await model.generateContent(prompt);
    console.log("\n✨ IA DMR4 (Dentalmovilr4) dice:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(result.response.text());
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    console.log("\n⚠️ Error: Revisa si ya agotaste tus 20 mensajes gratis de hoy o si la API Key en Replit es correcta.");
  }
}

iniciarIA();
