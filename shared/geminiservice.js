const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * DMR4-AI-Core: Conector Maestro de Gemini
 * Desarrollado por Dentalmovilr4
 */
class GeminiService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);

    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    this.config = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    };
  }

  async generarRespuesta({ contexto, promptUsuario, historial = [] }) {
    const systemInstruction = `Eres un experto del ecosistema DMR4.
Contexto: ${contexto}.
Responde como desarrollador: claro, técnico y sin relleno.`;

    try {
      const timeout = (ms) =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout IA")), ms)
        );

      const request = this.model.generateContent({
        contents: [
          ...historial,
          {
            role: "user",
            parts: [{ text: promptUsuario }],
          },
        ],
        systemInstruction: {
          role: "system",
          parts: [{ text: systemInstruction }],
        },
        generationConfig: this.config,
      });

      const result = await Promise.race([request, timeout(10000)]);

      const text = result?.response?.text?.();

      if (!text) {
        return "🤖 Respuesta vacía del modelo.";
      }

      return text.trim();
    } catch (error) {
      console.error("❌ DMR4-AI-Core:", error?.message || error);

      if (error?.message?.includes("API key")) {
        return "🔑 API Key inválida.";
      }

      if (error?.message?.includes("quota")) {
        return "📉 Límite de uso alcanzado.";
      }

      if (error?.message?.includes("Timeout")) {
        return "⏱️ La IA tardó demasiado en responder.";
      }

      return "⚠️ Error en el cerebro de IA.";
    }
  }
}

module.exports = GeminiService;