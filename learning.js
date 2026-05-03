const fs = require('fs/promises');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'memory.json');

// ----------------------
// CARGAR MEMORIA
// ----------------------

async function cargarMemoria() {
  try {
    const raw = await fs.readFile(MEMORY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ----------------------
// GUARDAR MEMORIA
// ----------------------

async function guardarMemoria(mem) {
  await fs.writeFile(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

// ----------------------
// REGISTRAR EVENTO
// ----------------------

async function registrar(repo, tipo, valor) {
  const mem = await cargarMemoria();

  if (!mem[repo]) {
    mem[repo] = {
      fallos: 0,
      reinicios: 0,
      exitos: 0,
      historial: []
    };
  }

  const entry = mem[repo];

  if (tipo === 'fallo') entry.fallos++;
  if (tipo === 'reinicio') entry.reinicios++;
  if (tipo === 'exito') entry.exitos++;

  entry.historial.push({
    tipo,
    valor,
    time: Date.now()
  });

  // Limitar historial (no infinito)
  if (entry.historial.length > 50) {
    entry.historial.shift();
  }

  await guardarMemoria(mem);
}

// ----------------------
// ANALIZAR COMPORTAMIENTO
// ----------------------

async function evaluar(repo) {
  const mem = await cargarMemoria();

  const data = mem[repo];
  if (!data) return 'NORMAL';

  // 🔥 DECISIONES BASADAS EN HISTORIAL

  if (data.fallos > 5) return 'INESTABLE';
  if (data.reinicios > 5) return 'PROBLEMATICO';
  if (data.exitos > data.fallos) return 'SALUDABLE';

  return 'NORMAL';
}

module.exports = {
  registrar,
  evaluar
};