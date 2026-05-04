const fs = require('fs');

function w(f,c){fs.writeFileSync(f,c);console.log("✔",f);}

// =====================
// .env
// =====================
w('.env',`REDIS_URL=redis://127.0.0.1:6379
BASE_DIR=/data/data/com.termux/files/home
NODE_ID=node1
`);

// =====================
// queue.js
// =====================
w('queue.js',`
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL);
async function pushTask(t){await r.lpush('dmr4:tasks',JSON.stringify(t));}
async function popTask(){const x=await r.brpop('dmr4:tasks',1);return x?JSON.parse(x[1]):null;}
module.exports={pushTask,popTask};
`);

// =====================
// metrics.js
// =====================
w('metrics.js',`
const os=require('os');
function cpu(){
  const c=os.cpus();let idle=0,total=0;
  c.forEach(x=>{for(let t in x.times){total+=x.times[t]} idle+=x.times.idle});
  return Math.round(100-(idle/total)*100);
}
function ram(){
  const t=os.totalmem(),f=os.freemem();
  return Math.round(((t-f)/t)*100);
}
module.exports={cpu,ram};
`);

// =====================
// leader.js (ELECCIÓN LÍDER)
// =====================
w('leader.js',`
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL);
const ID=process.env.NODE_ID;

async function soyLider(){
  const res=await r.set('dmr4:leader',ID,'NX','EX',5);
  if(res==='OK') return true;

  const actual=await r.get('dmr4:leader');
  if(actual===ID){
    await r.expire('dmr4:leader',5);
    return true;
  }
  return false;
}

module.exports={soyLider};
`);

// =====================
// scheduler.js (CEREBRO CLOUD)
// =====================
w('scheduler.js',`
require('dotenv').config();
const Redis=require('ioredis');
const {soyLider}=require('./leader');
const r=new Redis(process.env.REDIS_URL);

function elegirNodo(nodos){
  if(!nodos.length) return null;
  return nodos.reduce((m,n)=>{
    const s=(n.cpu*0.7)+(n.ram*0.3);
    if(!m||s<m.score) return {...n,score:s};
    return m;
  },null);
}

async function ciclo(){

  if(!(await soyLider())) return;

  const nodosRaw=await r.hgetall('dmr4:nodes');
  const nodos=Object.entries(nodosRaw).map(([id,v])=>{
    const x=JSON.parse(v);
    return {id,...x};
  });

  const procesos=await r.hgetall('dmr4:procesos');

  if(nodos.length===0){
    console.log("⚠️ sin nodos");
    return;
  }

  // ejemplo: siempre mantener 1 servicio llamado "app1"
  if(!procesos['app1']){
    const n=elegirNodo(nodos);
    if(!n) return;

    await r.lpush('dmr4:tasks',JSON.stringify({
      action:'start',
      repo:'app1',
      targetNode:n.id
    }));

    console.log("🧠 líder asignó app1 →",n.id);
  }
}

setInterval(ciclo,3000);
console.log("🧠 Scheduler iniciado");
`);

// =====================
// worker.js
// =====================
w('worker.js',`
require('dotenv').config();
const {popTask}=require('./queue');
const {spawn}=require('child_process');
const path=require('path');
const Redis=require('ioredis');
const {cpu,ram}=require('./metrics');

const r=new Redis(process.env.REDIS_URL);
const ID=process.env.NODE_ID;
const BASE=process.env.BASE_DIR;

let procs={},restarts={};

// heartbeat nodo
setInterval(async()=>{
  await r.hset('dmr4:nodes',ID,JSON.stringify({
    cpu:cpu(),
    ram:ram(),
    timestamp:Date.now()
  }));
},2000);

async function start(repo){
  if(procs[repo]) return;
  if(await r.hget('dmr4:procesos',repo)) return;

  const c=spawn('node',['server.js'],{
    cwd:path.join(BASE,repo),
    detached:true,
    stdio:'ignore'
  });

  c.unref();
  procs[repo]={pid:c.pid};
  restarts[repo]=0;

  await r.hset('dmr4:procesos',repo,JSON.stringify({
    repo,node:ID,pid:c.pid,timestamp:Date.now()
  }));

  console.log("🚀",repo,"@",ID);
}

async function stop(repo){
  if(!procs[repo]) return;
  try{process.kill(procs[repo].pid);}catch{}
  delete procs[repo];
  await r.hdel('dmr4:procesos',repo);
}

setInterval(async()=>{
  for(const k in procs){
    try{process.kill(procs[k].pid,0);}
    catch{
      restarts[k]++;
      if(restarts[k]>5){await stop(k);continue;}
      await start(k);
    }
  }
},10000);

(async()=>{
  console.log("👷",ID,"online");
  while(true){
    const t=await popTask();
    if(!t){await new Promise(r=>setTimeout(r,200));continue;}
    if(t.targetNode && t.targetNode!==ID) continue;

    if(t.action==='start') await start(t.repo);
    if(t.action==='stop') await stop(t.repo);
  }
})();
`);

// =====================
// failover.js
// =====================
w('failover.js',`
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL);

async function detectarFallos(){
  const now=Date.now();
  const p=await r.hgetall('dmr4:procesos');
  const n=await r.hgetall('dmr4:nodes');

  const nodos=Object.fromEntries(
    Object.entries(n).map(([k,v])=>[k,JSON.parse(v)])
  );

  for(const [repo,raw] of Object.entries(p)){
    const x=JSON.parse(raw);

    const nodo=nodos[x.node];
    const muerto=!nodo||(now-nodo.timestamp>15000)||(now-x.timestamp>10000);

    if(muerto){
      console.log("💀",repo);

      await r.hdel('dmr4:procesos',repo);

      await r.lpush('dmr4:tasks',JSON.stringify({
        action:'start',
        repo,
        reason:'failover'
      }));
    }
  }
}

setInterval(detectarFallos,4000);
console.log("🛡️ Failover activo");
`);

// =====================
// api.js
// =====================
w('api.js',`
require('dotenv').config();
const express=require('express');
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL);
const app=express();

app.use(express.json());

app.get('/metrics',async(req,res)=>{
  const n=await r.hgetall('dmr4:nodes');
  const p=await r.hgetall('dmr4:procesos');
  res.json({nodes:n,procesos:p});
});

app.listen(3001,()=>console.log("API 3001"));
`);

console.log("\\n🔥 CLOUD READY");
