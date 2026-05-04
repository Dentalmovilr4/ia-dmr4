
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL);
async function pushTask(t){await r.lpush('dmr4:tasks',JSON.stringify(t));}
async function popTask(){const x=await r.brpop('dmr4:tasks',1);return x?JSON.parse(x[1]):null;}
module.exports={pushTask,popTask};
