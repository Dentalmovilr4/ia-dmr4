const fs = require('fs');
function w(f,c){fs.writeFileSync(f,c);console.log("✔",f);}

// =====================
// .env
// =====================
w('.env',`REDIS_URL=redis://127.0.0.1:6379
BASE_DIR=/data/data/com.termux/files/home
NODE_ID=node1
REGION=us-east
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
function cpu(){const c=os.cpus();let i=0,t=0;c.forEach(x=>{for(let k in x.times){t+=x.times[k]}i+=x.times.idle});return Math.round(100-(i/t)*100);}
function ram(){const t=os.totalmem(),f=os.freemem();return Math.round(((t-f)/t)*100);}
module.exports={cpu,ram};
`);

// =====================
// leader.js (por región)
// =====================
w('leader.js',`
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL);
const ID=process.env.NODE_ID;
const REGION=process.env.REGION;

async function soyLider(){
  const key='dmr4:leader:'+REGION;
  const res=await r.set(key,ID,'NX','EX',5);
  if(res==='OK') return true;
  const actual=await r.get(key);
  if(actual===ID){await r.expire(key,5);return true;}
  return false;
}
module.exports={soyLider};
`);

// =====================
// scheduler.js (aware región)
// =====================
w('scheduler.js',`
require('dotenv').config();
const Redis=require('ioredis');
const {soyLider}=require('./leader');
const r=new Redis(process.env.REDIS_URL);
const REGION=process.env.REGION;

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

  // filtra por región local primero
  const locales=nodos.filter(n=>n.region===REGION);
  const remotos=nodos.filter(n=>n.region!==REGION);

  const procesos=await r.hgetall('dmr4:procesos');

  // ejemplo servicio
  const servicio='app1';

  if(!procesos[servicio]){
    let n=elegirNodo(locales);
    let cross=false;

    if(!n){
      n=elegirNodo(remotos);
      cross=true;
    }

    if(!n) return;

    await r.lpush('dmr4:tasks',JSON.stringify({
      action:'start',
      repo:servicio,
      targetNode:n.id,
      region:n.region,
      crossRegion:cross
    }));

    console.log("🧠",REGION,"→",servicio,"@",n.id,(cross?"(cross-region)":""));
  }
}

setInterval(ciclo,3000);
console.log("🧠 Scheduler",REGION);
`);

// =====================
// worker.js (reporta región)
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
const REGION=process.env.REGION;

let procs={},restarts={};

// heartbeat nodo con región
setInterval(async()=>{
  await r.hset('dmr4:nodes',ID,JSON.stringify({
    cpu:cpu(),
    ram:ram(),
    region:REGION,
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
    repo,node:ID,region:REGION,pid:c.pid,timestamp:Date.now()
  }));

  console.log("🚀",repo,"@",ID,"(",REGION,")");
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
  console.log("👷",ID,"online",REGION);
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
// failover.js (multi-region)
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
      console.log("💀",repo,"(",x.region,")");

      await r.hdel('dmr4:procesos',repo);

      await r.lpush('dmr4:tasks',JSON.stringify({
        action:'start',
        repo,
        reason:'failover',
        lastRegion:x.region
      }));
    }
  }
}

setInterval(detectarFallos,4000);
console.log("🛡️ Failover multi-region");
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

app.get('/metrics',async(req,res)=>{
  const n=await r.hgetall('dmr4:nodes');
  const p=await r.hgetall('dmr4:procesos');
  res.json({nodes:n,procesos:p});
});

app.listen(3001,()=>console.log("API 3001"));
`);

console.log("\\n🌍 MULTI-REGION READY");
