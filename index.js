require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURACIÓN ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const RUTA_BASE = process.env.RUTA_BASE || '/data/data/com.termux/files/home/proyectos-dmr4';

// Carpetas que NUNCA vamos a escanear para no colgar el móvil
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.cache'];

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ Error: Configura TELEGRAM_TOKEN y TELEGRAM_CHAT_ID en tu .env');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// --- UTILIDADES ---
const escapeHtml = (str) => 
  str.replace(/[&<>"']/g, m => ({ 
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
  }[m]));

/**
 * Busca todos los archivos .js de forma recursiva ignorando carpetas prohibidas
 */
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
    console.error(`⚠️ No se pudo acceder a: ${dir}`);
  }
  return lista;
}

// --- MOTOR DE ANÁLISIS 2.0 ---
function analizarContenido(codigo, nombreArchivo) {
  const hallazgos = { errores: [], sugerencias: [], criticidad: 0 };

  // 1. Seguridad: Hardcoded Secrets
  if (/(password|secret|key|token|private_key)\s*=\s*['"][^'"]{8,}['"]/i.test(codigo)) {
    hallazgos.errores.push("🔒 <b>Secreto expuesto:</b> Llaves detectadas directamente en el código.");
    hallazgos.criticidad += 10;
  }

  // 2. Seguridad: Inyección de dependencias (Helmet)
  if (codigo.includes('express()') && !codigo.includes('helmet')) {
    hallazgos.sugerencias.push("🛡️ Falta <code>helmet</code> para proteger cabeceras HTTP.");
    hallazgos.criticidad += 2;
  }

  // 3. Promesas: Control de errores
  const promesasSinCatch = (codigo.match(/\.then\(/g) || []).length;
  const catches = (codigo.match(/\.catch\(/g) || []).length;
  if (promesasSinCatch > catches) {
    hallazgos.errores.push("⚠️ <b>Promesas inestables:</b> Tienes .then() sin su respectivo .catch().");
    hallazgos.criticidad += 5;
  }

  // 4. Inyección SQL/NoSQL básica
  if (codigo.includes('${req.query') || codigo.includes('${req.body')) {
    hallazgos.errores.push("🚨 <b>Riesgo de Inyección:</b> Evita concatenar variables de request en strings.");
    hallazgos.criticidad += 15;
  }

  // 5. Calidad: Uso de var
  if (/\bvar\s+\w+/.test(codigo)) {
    hallazgos.sugerencias.push("💡 Cambia <code>var</code> por <code>const</code> o <code>let</code>.");
  }

  return hallazgos;
}

// --- PROCESADOR PRINCIPAL ---
async function ejecutarAuditoria() {
  console.log('🔍 IA-DMR4: Iniciando escaneo profundo v2.0...');
  const resultados = [];
  
  try {
    const archivos = await obtenerArchivosJS(RUTA_BASE);
    
    // CORREGIDO: Usando 'of' en lugar de 'de'
    for (const archivo of archivos) {
      const contenido = await fs.readFile(archivo, 'utf8');
      const relativo = path.relative(RUTA_BASE, archivo);
      const analisis = analizarContenido(contenido, relativo);
      
      if (analisis.errores.length > 0 || analisis.sugerencias.length > 0) {
        resultados.push({ archivo: relativo, ...analisis });
      }
    }

    await enviarInformeProfesional(resultados, archivos.length);
  } catch (error) {
    console.error('❌ Error crítico en auditoría:', error.message);
  }
}

async function enviarInformeProfesional(resultados, totalArchivos) {
  const erroresTotales = resultados.reduce((acc, r) => acc + r.errores.length, 0);
  const sugerenciasTotales = resultados.reduce((acc, r) => acc + r.sugerencias.length, 0);
  
  let header = `<b>📊 INFORME TÉCNICO DMR4 v2.0</b>\n`;
  header += `<code>----------------------------</code>\n`;
  header += `📂 Total archivos .js: <b>${totalArchivos}</b>\n`;
  header += `❌ Errores críticos: <b>${erroresTotales}</b>\n`;
  header += `💡 Sugerencias: <b>${sugerenciasTotales}</b>\n\n`;

  let cuerpo = '';
  // Ordenar por criticidad (lo más grave arriba)
  resultados.sort((a, b) => b.criticidad - a.criticidad);

  // Mostrar solo los 8 más críticos para no saturar Telegram
  const topResultados = resultados.slice(0, 8);

  for (const res of topResultados) {
    cuerpo += `<b>📄 ${escapeHtml(res.archivo)}</b>\n`;
    res.errores.forEach(e => cuerpo += `${e}\n`);
    res.sugerencias.forEach(s => cuerpo += `${s}\n`);
    cuerpo += `\n`;
  }

  if (resultados.length > 8) {
    cuerpo += `<i>...y ${resultados.length - 8} archivos más con detalles menores.</i>`;
  }

  const mensajeFinal = header + cuerpo;
  
  // Dividir mensaje si es muy largo (límite Telegram 4096 caracteres)
  const chunks = mensajeFinal.match(/[\s\S]{1,4000}(?=\n|$)/g) || [mensajeFinal];
  
  for (const chunk of chunks) {
    await bot.sendMessage(TELEGRAM_CHAT_ID, chunk, { parse_mode: 'HTML' });
  }
  
  console.log('✅ Auditoría finalizada y enviada a Telegram.');
}

// Ejecución
ejecutarAuditoria();

