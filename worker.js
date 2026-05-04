require('dotenv').config();

const { popTask } = require('./queue');
const { spawn } = require('child_process');
const path = require('path');

const BASE = process.env.BASE_DIR;

let procesos = {};

// ----------------------
// EJECUTAR PROCESO
// ----------------------
function startRepo(repo) {
  const ruta = path.join(BASE, repo);

  const child = spawn('node', ['server.js'], {
    cwd: ruta,
    detached: true,
    stdio: 'ignore'
  });

  child.unref();

  procesos[repo] = {
    pid: child.pid,
    start: Date.now()
  };

  console.log(`🚀 ${repo} iniciado`);
}

// ----------------------
// DETENER
// ----------------------
function stopRepo(repo) {
  if (!procesos[repo]) return;

  try {
    process.kill(procesos[repo].pid);
  } catch {}

  delete procesos[repo];

  console.log(`🛑 ${repo} detenido`);
}

// ----------------------
// AUTO-HEALING
// ----------------------
setInterval(() => {
  for (const repo in procesos) {
    try {
      process.kill(procesos[repo].pid, 0);
    } catch {
      console.log(`♻️ Reiniciando ${repo}`);
      startRepo(repo);
    }
  }
}, 10000);

// ----------------------
// LOOP PRINCIPAL
// ----------------------
async function loop() {
  while (true) {

    const task = await popTask();

    if (!task) continue;

    if (task.action === 'start') {
      startRepo(task.repo);
    }

    if (task.action === 'stop') {
      stopRepo(task.repo);
    }
  }
}

loop();