const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * DMR4-AI-Core: Conector Maestro de Gemini
 * Desarrollado por Dentalmovilr4
 */
class GeminiService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.config = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    };
  }

  async generarRespuesta(contexto, promptUsuario) {
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const systemInstruction = `Eres un experto del ecosistema DMR4. 
      Contexto de especialidad: ${contexto}. 
      Responde como un colega desarrollador, técnico y eficiente.`;

      const result = await model.generateContent({
        contents: [{ 
          role: "user", 
          parts: [{ text: `${systemInstruction}\n\nPregunta: ${promptUsuario}` }] 
        }],
        generationConfig: this.config,
      });

      return result.response.text();
    } catch (error) {
      console.error("❌ Error en DMR4-AI-Core:", error);
      return "Error en el cerebro de IA, colega. Revisa la API Key o la conexión.";
    }
  }
}

module.exports = GeminiService;
