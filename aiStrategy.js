require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const learning = require('./learning');
const { obtenerDatosToken } = require('./dex');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ----------------------
// GENERAR CONTEXTO
// ----------------------

async function construirContexto() {
  const token = await obtenerDatosToken();

  return {
    mercado: token,
    timestamp: new Date().toISOString()
  };
}

// ----------------------
// DECISIÓN DE ESTRATEGIA
// ----------------------

async function decidirEstrategia() {
  const contexto = await construirContexto();

  const prompt = `
Eres un sistema experto en automatización y trading.

Datos:
- Liquidez: ${contexto.mercado.liquidez}
- Precio: ${contexto.mercado.precio}
- Volumen: ${contexto.mercado.volumen}

Responde SOLO con una palabra:
AGRESIVO, CONSERVADOR, DEFENSIVO o EXPANSIVO
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent(prompt);
    const texto = result.response.text().trim();

    return texto;
  } catch (e) {
    return "CONSERVADOR"; // fallback inteligente
  }
}

module.exports = { decidirEstrategia };