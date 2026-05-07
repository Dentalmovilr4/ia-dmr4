const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

(async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY no configurada.");
    process.exit(1);
  }

  // Verificar si existe el archivo de errores generado por el scanner
  const errorsPath = path.join(process.cwd(), 'errors.json');
  if (!fs.existsSync(errorsPath)) {
    console.log("✅ No se encontraron errores para corregir.");
    process.exit(0);
  }

  const errors = JSON.parse(fs.readFileSync(errorsPath, 'utf8'));
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  for (const file of errors) {
    console.log(`🧠 Procesando corrección para: ${file}...`);
    const code = fs.readFileSync(file, 'utf8');

    const prompt = `
Eres un Ingeniero de Software Senior experto en Node.js.
Tu tarea es corregir los errores de sintaxis o lógica en el siguiente archivo.

REGLAS STRICTAS:
1. Devuelve ÚNICAMENTE el código corregido.
2. NO incluyas explicaciones, saludos ni bloques de Markdown (sin \`\`\`javascript).
3. Mantén la lógica original, solo arregla lo que impide que el código funcione.

ARCHIVO: ${file}
CÓDIGO ORIGINAL:
${code}
`;

    try {
      const result = await model.generateContent(prompt);
      let fixedCode = result.response.text();

      // Limpieza de seguridad por si la IA ignora las reglas y pone backticks
      fixedCode = fixedCode.replace(/^```javascript\n|^```\n|```$/g, '').trim();

      if (fixedCode) {
        fs.writeFileSync(file, fixedCode);
        console.log(`✅ Archivo ${file} actualizado correctamente.`);
      }
    } catch (e) {
      console.error(`❌ Error al corregir ${file}:`, e.message);
    }
  }
})();
