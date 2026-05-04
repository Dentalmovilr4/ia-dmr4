
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
