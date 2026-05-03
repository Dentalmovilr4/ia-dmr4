const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

(async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    process.exit(0);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const context = fs.readFileSync('context.txt', 'utf8');

  const prompt = `
Eres un ingeniero senior.
Corrige errores del proyecto Node.js.

Reglas:
- Devuelve SOLO un patch en formato unified diff (git diff)
- No expliques nada
- Cambios mínimos necesarios
- No rompas funcionalidad existente

Contexto:
${context}
`;

  try {
    const result = await model.generateContent(prompt);
    const patch = result.response.text();

    if (patch.includes('diff')) {
      fs.writeFileSync('fix.patch', patch);
      console.log("✅ Patch generado");
    } else {
      console.log("⚠️ No se generó patch válido");
    }

  } catch (e) {
    console.error("Error IA:", e.message);
  }
})();