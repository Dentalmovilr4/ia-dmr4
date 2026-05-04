/**
 * IA-DMR4 WORKER PRO - FINAL ESTABLE
 * Cluster + Lock + Anti-duplicados + Scheduler compatible
 */

require('dotenv').config();

const { popTask } = require('./queue');
const { spawn } = require('child_process');
const path = require('path');
const Redis = require('ioredis');

const BASE = process.env.BASE_DIR;
const NODE_ID = process.env.NODE_ID || 'node1';

const redis = new Redis(process.env.REDIS_URL);

let procesos = {};
let reinicios = {};

// =========================
// 🔒 LOCK DISTRIBUIDO
// =========================

async function acquireLock(repo) {
  const key = `lock:${repo}`;
  const res = await redis.set(key, NODE_ID, 'NX', 'EX', 30);
  return res === 'OK';
}

async function releaseLock(repo) {
  await redis.del(`lock:${repo}`);
}

// =========================
// REDIS (IMPORTANTE FIX)
// =========================

async function registrarProceso(repo, pid) {
  await redis.hset('dmr4:procesos', repo, JSON.stringify({
    repo, // 🔥 FIX CLAVE
    node: NODE_ID,
    pid,
    timestamp: Date.now()
  }));
}

async function eliminarProceso(repo) {
  await redis.hdel('dmr4:procesos', repo);
}

// =========================
// VALIDACIONES
// =========================

async function yaExisteGlobal(repo) {
  const data = await redis.hget('dmr4:procesos', repo);
  return !!data;
}

function yaExisteLocal(repo) {
  return !!procesos[repo];
}

// =========================
// LIMPIEZA INICIAL (CRÍTICO)
// =========================

async function limpiarZombies() {
  for (const repo in procesos) {
    try {
      process.kill(procesos[repo].pid, 0);
    } catch {
      delete procesos[repo];
      await eliminarProceso(repo);
    }
  }
}

// =========================
// START
// =========================

async function startRepo(repo) {

  // evitar duplicado local
  if (yaExisteLocal(repo)) {
    console.log(`⚠️ ${repo} ya está corriendo en este nodo`);
    return;
  }

  // evitar duplicado global
  if (await yaExisteGlobal(repo)) {
    console.log(`⚠️ ${repo} ya existe en cluster`);
    return;
  }

  const locked = await acquireLock(repo);
  if (!locked) {
    console.log(`🔒 ${repo} bloqueado`);
    return;
  }

  try {

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

    reinicios[repo] = 0;

    await registrarProceso(repo, child.pid);

    console.log(`🚀 ${repo} iniciado en ${NODE_ID}`);

  } catch (err) {
    console.error(`❌ Error start ${repo}: ${err.message}`);
  } finally {
    await releaseLock(repo);
  }
}

// =========================
// STOP
// =========================

async function stopRepo(repo) {

  if (!procesos[repo]) return;

  try {
    process.kill(procesos[repo].pid);
  } catch {}

  delete procesos[repo];

  await eliminarProceso(repo);

  console.log(`🛑 ${repo} detenido en ${NODE_ID}`);
}

// =========================
// AUTO-HEALING
// =========================

setInterval(async () => {

  for (const repo in procesos) {

    try {
      process.kill(procesos[repo].pid, 0);
    } catch {

      reinicios[repo] = (reinicios[repo] || 0) + 1;

      if (reinicios[repo] > 5) {
        console.log(`⛔ ${repo} bloqueado por fallos`);
        await stopRepo(repo);
        continue;
      }

      console.log(`♻️ Reiniciando ${repo} (${reinicios[repo]})`);
      await startRepo(repo);
    }
  }

}, 10000);

// =========================
// LOOP
// =========================

async function loop() {

  console.log(`👷 Worker ${NODE_ID} ONLINE`);

  await limpiarZombies();

  while (true) {

    try {

      const task = await popTask();

      if (!task) {
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      // 🎯 RESPETO DE NODO
      if (task.targetNode && task.targetNode !== NODE_ID) {
        continue;
      }

      if (task.action === 'start') {
        await startRepo(task.repo);
      }

      if (task.action === 'stop') {
        await stopRepo(task.repo);
      }

    } catch (err) {
      console.error(`❌ Worker error: ${err.message}`);
    }
  }
}

// =========================
// START
// =========================

loop();