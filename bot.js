require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;

// ---------------------------------------------------------
// VALIDACIÓN DE ENTORNO
// ---------------------------------------------------------
if (!token) {
  console.error("❌ ERROR: TELEGRAM_TOKEN no definido");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });
console.log("🤖 Sistema de Alertas DMR4 Online");

// ---------------------------------------------------------
// UTILIDADES DE FORMATO
// ---------------------------------------------------------
const obtenerFecha = () => new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

// ---------------------------------------------------------
// ENVÍO DE MENSAJES CON SOPORTE DE FRAGMENTACIÓN
// ---------------------------------------------------------
async function enviarMensaje(texto) {
  if (!chatId) return;
  try {
    const partes = texto.match(/[\s\S]{1,4000}/g) || [texto];
    for (const parte of partes) {
      await bot.sendMessage(chatId, parte, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error("❌ Error en el túnel de Telegram:", err.message);
  }
}

// ---------------------------------------------------------
// ALERTAS CON ESTRUCTURA VISUAL (ESTILO DASHBOARD)
// ---------------------------------------------------------
async function alerta(tipo, mensaje) {
  const configuracion = {
    error:   { icono: "🔴", titulo: "ERROR CRÍTICO" },
    warning: { icono: "🟡", titulo: "ADVERTENCIA" },
    success: { icono: "🟢", titulo: "ÉXITO" },
    info:    { icono: "🔵", titulo: "SISTEMA" },
    money:   { icono: "💵", titulo: "MERCADO" }
  };

  const conf = configuracion[tipo] || { icono: "🤖", titulo: "DMR4 NOTIFICACIÓN" };

  const textoEstructurado = `
${conf.icono} <b>${conf.titulo}</b>
<code>------------------------------</code>
<b>📌 Evento:</b> ${mensaje}
<b>📅 Fecha:</b> <code>${obtenerFecha()}</code>
<code>------------------------------</code>
⚙️ <i>IA-DMR4 Autopilot Activo</i>
  `;

  await enviarMensaje(textoEstructurado);
}

// ---------------------------------------------------------
// LOG DE SISTEMA (ESTILO TERMINAL)
// ---------------------------------------------------------
async function logSistema(msg) {
  const textoLog = `
📊 <b>DMR4 SYSTEM LOG</b>
<code>______________________________</code>
<pre>
${msg}
</pre>
<code>______________________________</code>
📡 <i>Nodo: Oppo-A57</i>
  `;
  await enviarMensaje(textoLog);
}

module.exports = {
  bot,
  chatId,
  enviarMensaje,
  alerta,
  logSistema
};

