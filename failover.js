
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
