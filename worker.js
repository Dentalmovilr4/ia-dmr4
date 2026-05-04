
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
