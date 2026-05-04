const fs=require('fs');function w(f,c){fs.writeFileSync(f,c);console.log("✔",f)}

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
// latency.js (PING REAL)
// =====================
w('latency.js',`
const {exec}=require('child_process');

function ping(host){
  return new Promise(res=>{
    exec('ping -c 1 -W 1 '+host,(e,stdout)=>{
      if(e) return res(999);
      const m=stdout.match(/time=(\\d+\\.?\\d*)/);
      res(m?parseFloat(m[1]):999);
    });
  });
}

module.exports={ping};
`);

// =====================
// leader.js
// =====================
w('leader.js',`
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL);
const ID=process.env.NODE_ID;
const REGION=process.env.REGION;

async function soyLider(){
  const key='dmr4:leader:'+REGION;
  const ok=await r.set(key,ID,'NX','EX',5);
  if(ok==='OK') return true;
  const cur=await r.get(key);
  if(cur===ID){await r.expire(key,5);return true;}
  return false;
}
module.exports={soyLider};
`);

// =====================
// scheduler.js (LATENCIA + CARGA)
// =====================
w('scheduler.js',`
require('dotenv').config();
const Redis=require('ioredis');
const {soyLider}=require('./leader');
const {ping}=require('./latency');

const r=new Redis(process.env.REDIS_URL);
const REGION=process.env.REGION;

// mapa simple de hosts por región (ajústalo a tus IPs)
const REGION_HOST={
  'us-east':'8.8.8.8',
  'eu-west':'1.1.1.1',
  'sa-south':'8.8.4.4'
};

async function elegirNodo(nodos){

  let mejor=null;

  for(const n of nodos){

    const host=REGION_HOST[n.region]||'8.8.8.8';
    const lat=await ping(host);

    const score=(n.cpu*0.5)+(n.ram*0.2)+(lat*0.3);

    if(!mejor || score<mejor.score){
      mejor={...n,score,lat};
    }
  }

  return mejor;
}

async function ciclo(){

  if(!(await soyLider())) return;

  const raw=await r.hgetall('dmr4:nodes');
  const nodos=Object.entries(raw).map(([id,v])=>{
    const x=JSON.parse(v);
    return {id,...x};
  });

  const procesos=await r.hgetall('dmr4:procesos');

  const servicio='app1';

  if(!procesos[servicio]){

    const n=await elegirNodo(nodos);
    if(!n) return;

    await r.lpush('dmr4:tasks',JSON.stringify({
      action:'start',
      repo:servicio,
      targetNode:n.id,
      region:n.region,
      latency:n.lat
    }));

    console.log("🧠 GLOBAL →",servicio,"@",n.id,"lat:",n.lat);
  }
}

setInterval(ciclo,4000);
console.log("🧠 ULTRA GLOBAL SCHEDULER");
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
const REGION=process.env.REGION;

let procs={},restarts={};

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

(async()=>{
  console.log("👷",ID,REGION);
  while(true){
    const t=await popTask();
    if(!t){await new Promise(r=>setTimeout(r,200));continue;}
    if(t.targetNode && t.targetNode!==ID) continue;

    if(t.action==='start') await start(t.repo);
  }
})();
`);

// =====================
// failover.js
// =====================
w('failover.js',`
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL);

async function loop(){
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
        reason:'failover-global'
      }));
    }
  }
}

setInterval(loop,4000);
console.log("🛡️ GLOBAL FAILOVER");
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

console.log("\\n🌐 ULTRA GLOBAL READY");
