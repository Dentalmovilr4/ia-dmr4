
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
