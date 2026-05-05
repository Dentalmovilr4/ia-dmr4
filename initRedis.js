const Redis = require('ioredis');
const fs = require('fs');
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
redis.set('cluster:repos', JSON.stringify(data)).then(() => {
  console.log("✅ Dados mestre carregados em Redis");
  process.exit();
});
