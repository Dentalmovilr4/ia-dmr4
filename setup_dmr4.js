const fs = require('fs');

function write(file, content) {
  fs.writeFileSync(file, content);
  console.log("✔", file);
}

// =====================
// .env
// =====================
write('.env', `REDIS_URL=redis://127.0.0.1:6379
BASE_DIR=/data/data/com.termux/files/home
NODE_ID=node1
`);

// =====================
// queue.js
// =====================
write('queue.js', `
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

async function pushTask(task){
  await redis.lpush('dmr4:tasks', JSON.stringify(task));
}

async function popTask(){
  const res = await redis.brpop('dmr4:tasks', 1);
  return res ? JSON.parse(res[1]) : null;
}

module.exports = { pushTask, popTask };
`);

// =====================
// metrics.js
// =====================
write('metrics.js', `
const os = require('os');

function cpuUsage(){
  const cpus = os.cpus();
  let idle=0,total=0;
  cpus.forEach(c=>{
    for(let t in c.times){ total+=c.times[t]; }
    idle+=c.times.idle;
  });
  return Math.round(100-(idle/total)*100);
}

function ramUsage(){
  const t=os.totalmem();
  const f=os.freemem();
  return Math.round(((t-f)/t)*100);
}

module.exports={cpuUsage,ramUsage};
`);

// =====================
// worker.js
// =====================
write('worker.js', `
require('dotenv').config();
const { popTask } = require('./queue');
const { spawn } = require('child_process');
const path = require('path');
const Redis = require('ioredis');
const { cpuUsage, ramUsage } = require('./metrics');

const redis = new Redis(process.env.REDIS_URL);
const NODE_ID = process.env.NODE_ID;
const BASE = process.env.BASE_DIR;

let procesos={};
let reinicios={};

setInterval(async()=>{
  await redis.hset('dmr4:nodes',NODE_ID,JSON.stringify({
    cpu:cpuUsage(),
    ram:ramUsage(),
    timestamp:Date.now()
  }));
},2000);

async function start(repo){
  if(procesos[repo]) return;
  if(await redis.hget('dmr4:procesos',repo)) return;

  const child=spawn('node',['server.js'],{
    cwd:path.join(BASE,repo),
    detached:true,
    stdio:'ignore'
  });

  child.unref();
  procesos[repo]={pid:child.pid};
  reinicios[repo]=0;

  await redis.hset('dmr4:procesos',repo,JSON.stringify({
    repo,node:NODE_ID,pid:child.pid,timestamp:Date.now()
  }));

  console.log("🚀",repo,NODE_ID);
}

async function stop(repo){
  if(!procesos[repo]) return;
  try{process.kill(procesos[repo].pid);}catch{}
  delete procesos[repo];
  await redis.hdel('dmr4:procesos',repo);
  console.log("🛑",repo);
}

setInterval(async()=>{
  for(const r in procesos){
    try{process.kill(procesos[r].pid,0);}
    catch{
      reinicios[r]=(reinicios[r]||0)+1;
      if(reinicios[r]>5){ await stop(r); continue; }
      await start(r);
    }
  }
},10000);

(async()=>{
  console.log("👷",NODE_ID,"ONLINE");
  while(true){
    const t=await popTask();
    if(!t){ await new Promise(r=>setTimeout(r,300)); continue; }
    if(t.targetNode && t.targetNode!==NODE_ID) continue;
    if(t.action==='start') await start(t.repo);
    if(t.action==='stop') await stop(t.repo);
  }
})();
`);

// =====================
// failover.js
// =====================
write('failover.js', `
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

async function detectarFallos(){
  const procesos = await redis.hgetall('dmr4:procesos');

  for(const [repo,raw] of Object.entries(procesos)){
    const p=JSON.parse(raw);
    if(Date.now()-p.timestamp>8000){
      console.log("💀",repo);
      await redis.hdel('dmr4:procesos',repo);
      await redis.lpush('dmr4:tasks',JSON.stringify({
        action:'start',repo
      }));
    }
  }
}

module.exports={detectarFallos};
`);

// =====================
// api.js
// =====================
write('api.js', `
require('dotenv').config();
const express = require('express');
const Redis = require('ioredis');

const app=express();
const redis=new Redis(process.env.REDIS_URL);

app.use(express.json());

app.get('/metrics', async(req,res)=>{
  const n=await redis.hgetall('dmr4:nodes');
  const p=await redis.hgetall('dmr4:procesos');

  res.json({
    nodes:Object.fromEntries(Object.entries(n).map(([k,v])=>[k,JSON.parse(v)])),
    procesos:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,JSON.parse(v)]))
  });
});

app.post('/start', async(req,res)=>{
  await redis.lpush('dmr4:tasks',JSON.stringify({
    action:'start',repo:req.body.repo
  }));
  res.json({ok:true});
});

app.post('/stop', async(req,res)=>{
  await redis.lpush('dmr4:tasks',JSON.stringify({
    action:'stop',repo:req.body.repo
  }));
  res.json({ok:true});
});

app.listen(3001,()=>console.log("API 3001"));
`);

// =====================
// panel.html
// =====================
write('panel.html', `
<!DOCTYPE html>
<html>
<body>
<h1>DMR4 PANEL</h1>
<button onclick="start()">START</button>
<div id="nodes"></div>
<div id="procs"></div>

<script>
async function load(){
  const r=await fetch('http://localhost:3001/metrics');
  const d=await r.json();

  nodes.innerHTML='';
  procs.innerHTML='';

  Object.entries(d.nodes).forEach(([id,n])=>{
    nodes.innerHTML+=\`🖥️ \${id} CPU:\${n.cpu}% RAM:\${n.ram}%<br>\`;
  });

  Object.entries(d.procesos).forEach(([id,p])=>{
    procs.innerHTML+=\`⚙️ \${id} @ \${p.node}
    <button onclick="stop('\${id}')">STOP</button><br>\`;
  });
}

async function start(){
  const repo=prompt("repo");
  await fetch('http://localhost:3001/start',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({repo})
  });
}

async function stop(repo){
  await fetch('http://localhost:3001/stop',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({repo})
  });
}

setInterval(load,2000);
</script>
</body>
</html>
`);

console.log("\\n🚀 TODO LISTO");
