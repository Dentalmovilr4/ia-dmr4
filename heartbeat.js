const Redis = require('ioredis');
const os = require('os');

const redis = new Redis(process.env.REDIS_URL);
const NODE_ID = process.env.NODE_ID || os.hostname();

setInterval(async () => {

  const data = {
    cpu: os.loadavg()[0],
    ram: (1 - os.freemem() / os.totalmem()),
    timestamp: Date.now()
  };

  await redis.hset('dmr4:nodes', NODE_ID, JSON.stringify(data));

}, 5000);