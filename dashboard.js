require('dotenv').config();
const express = require('express');
const Redis = require('ioredis');

const app = express();
const redis = new Redis(process.env.REDIS_URL);

app.get('/', async (req, res) => {

  const nodes = await redis.hgetall('dmr4:nodes');
  const procesos = await redis.hgetall('dmr4:procesos');

  res.json({
    nodes: Object.fromEntries(
      Object.entries(nodes).map(([k,v]) => [k, JSON.parse(v)])
    ),
    procesos: Object.fromEntries(
      Object.entries(procesos).map(([k,v]) => [k, JSON.parse(v)])
    )
  });
});

app.listen(3000, () => {
  console.log("📊 Dashboard en http://localhost:3000");
});
