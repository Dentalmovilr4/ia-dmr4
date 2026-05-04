
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
