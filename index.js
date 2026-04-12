require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURACIÓN ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// Ruta donde están todos tus proyectos en Termux
const HOME_DIR = '/data/data/com.termux/files/home';
const DATA_FILE = path.join(HOME_DIR, 'ia-dmr4', 'data.json');

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.cache'];

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ Error: Configura TOKEN y CHAT_ID en tu .env');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// --- UTILIDADES ---
const escapeHtml = (str) => 
  str.replace(/[&<>"']/g, m => ({ 
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
  }[m]));

// Busca archivos JS solo en las rutas que le pasemos
async function obtenerArchivosJS(dir, lista = []) {
  try {
    const entradas = await fs.readdir(dir, { withFileTypes: true });
    for (const entrada of entradas) {
      const rutaCompleta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (!IGNORE_DIRS.includes(entrada.name)) {
          await obtenerArchivosJS(rutaCompleta, lista);
        }
      } else if (entrada.name.endsWith('.js')) {
        lista.push(rutaCompleta);
      }
    }
  } catch (e) {
    // Si un repo de la lista no existe, no rompemos el script
    return lista;
  }
  return lista;
}

// --- MOTOR DE ANÁLISIS ---
function analizarContenido(codigo, nombreArchivo) {
  const hallazgos = { errores: [], sugerencias: [], criticidad: 0 };

  // Seguridad: Secretos
  if (/(password|secret|key|token|private_key)\s*=\s*['"][^'"]{8,}['"]/i.test(codigo)) {
    hallazgos.errores.push("🔒 <b>Secreto expuesto:</b> Llave detectada.");
    hallazgos.criticidad += 10;
  }
  // Seguridad: Helmet
  if (codigo.includes('express()') && !codigo.includes('helmet')) {
    hallazgos.sugerencias.push("🛡️ Falta <code>helmet</code>.");
    hallazgos.criticidad += 2;
  }
  // Riesgo Inyección
  if (codigo.includes('${req.query') || codigo.includes('${req.body')) {
    hallazgos.errores.push("🚨 <b>Riesgo de Inyección:</b> Variables de request concatenadas.");
    hallazgos.criticidad += 15;
  }
  // Calidad: Var
  if (/\bvar\s+\w+/.test(codigo)) {
    hallazgos.sugerencias.push("💡 Usa <code>const</code> o <code>let</code>.");
  }

  return hallazgos;
}

// --- PROCESADOR INTEGRADO CON DATA.JSON ---
async function ejecutarAuditoria() {
  console.log('🔍 IA-DMR4: Iniciando Auditoría desde data.json...');
  const resultados = [];
  let totalArchivosEscaneados = 0;

  try {
    // 1. Leer el archivo data.json
    const rawData = await fs.readFile(DATA_FILE, 'utf8');
    const repositorios = JSON.parse(rawData);

    // 2. Escanear cada proyecto de la lista
    for (const repoName of repositorios) {
      const rutaProyecto = path.join(HOME_DIR, repoName);
      const archivosDelProyecto = await obtenerArchivosJS(rutaProyecto);
      
      totalArchivosEscaneados += archivosDelProyecto.length;

      for (const archivo of archivosDelProyecto) {
        const contenido = await fs.readFile(archivo, 'utf8');
        const relativo = path.relative(HOME_DIR, archivo);
        const analisis = analizarContenido(contenido, relativo);

        if (analisis.errores.length > 0 || analisis.sugerencias.length > 0) {
          resultados.push({ archivo: relativo, ...analisis });
        }
      }
    }

    await enviarInformeProfesional(resultados, totalArchivosEscaneados, repositorios.length);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await bot.sendMessage(TELEGRAM_CHAT_ID, `❌ <b>Error:</b> No se pudo leer data.json`, {parse_mode: 'HTML'});
  }
}

async function enviarInformeProfesional(resultados, totalFiles, totalRepos) {
  const errores = resultados.reduce((acc, r) => acc + r.errores.length, 0);
  const sugerencias = resultados.reduce((acc, r) => acc + r.sugerencias.length, 0);

  let msg = `<b>📊 INFORME TÉCNICO DMR4 v3.0</b>\n`;
  msg += `<code>----------------------------</code>\n`;
  msg += `📁 Proyectos en data.json: <b>${totalRepos}</b>\n`;
  msg += `📄 Total archivos .js: <b>${totalFiles}</b>\n`;
  msg += `❌ Errores: <b>${errores}</b> | 💡 Sugerencias: <b>${sugerencias}</b>\n\n`;

  resultados.sort((a, b) => b.criticidad - a.criticidad);
  const top = resultados.slice(0, 10); // Mostramos los 10 peores

  for (const res of top) {
    msg += `<b>📄 ${escapeHtml(res.archivo)}</b>\n`;
    res.errores.forEach(e => msg += `${e}\n`);
    res.sugerencias.forEach(s => msg += `${s}\n`);
    msg += `\n`;
  }

  if (resultados.length > 10) msg += `<i>...y ${resultados.length - 10} más.</i>`;

  const chunks = msg.match(/[\s\S]{1,4000}(?=\n|$)/g) || [msg];
  for (const chunk of chunks) {
    await bot.sendMessage(TELEGRAM_CHAT_ID, chunk, { parse_mode: 'HTML' });
  }
  console.log('✅ Informe enviado.');
}

ejecutarAuditoria();

