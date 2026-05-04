const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const QUEUE = 'dmr4:tasks';

// ----------------------
// ENCOLAR TAREA
// ----------------------
async function pushTask(task) {
  await redis.lpush(QUEUE, JSON.stringify(task));
}

// ----------------------
// TOMAR TAREA
// ----------------------
async function popTask() {
  const data = await redis.brpop(QUEUE, 5);
  if (!data) return null;
  return JSON.parse(data[1]);
}

module.exports = {
  pushTask,
  popTask
};