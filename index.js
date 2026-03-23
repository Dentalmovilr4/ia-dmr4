const { GoogleGenerativeAI } = require("@google/generative-ai");

// Usamos una variable de entorno por seguridad
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function chat() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = process.argv.slice(2).join(" ") || "Hola, soy IA DMR4";

  try {
    const result = await model.generateContent(prompt);
    console.log("\n✨ IA DMR4 dice:");
    console.log(result.response.text());
  } catch (error) {
    console.log("Error: Verifica tu API Key o cuota.");
  }
}

chat();
