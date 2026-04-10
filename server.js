const fs = require('fs');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');

const app = express();
const BASE = '/data/data/com.termux/files/home/proyectos-dmr4';
const DB = './estado.json';

let procesos = {};

function guardarEstado(){
  fs.writeFileSync(DB, JSON.stringify(procesos));
}

function cargarEstado(){
  if(fs.existsSync(DB)){
    procesos = JSON.parse(fs.readFileSync(DB));
  }
}

function getPort(i){
  return 3100 + i;
}

function run(cmd, cwd){
  return new Promise(resolve=>{
    exec(cmd,{cwd},(err,out,errout)=>{
      resolve({error:err?err.message:null,salida:out||errout});
    });
  });
}

function crearProyecto(nombre,port){
  const ruta = path.join(BASE,nombre);
  if(fs.existsSync(ruta)) return;

  fs.mkdirSync(ruta);

  fs.writeFileSync(path.join(ruta,'package.json'),JSON.stringify({
    name:nombre,
    version:"1.0.0",
    main:"server.js",
    dependencies:{
      express:"^4.18.2",
      cors:"^2.8.5"
    }
  },null,2));

  fs.writeFileSync(path.join(ruta,'server.js'),`
const express=require('express');
const cors=require('cors');
const app=express();
app.use(cors());

app.get('/',(req,res)=>res.send('${nombre} activo en puerto ${port}'));

app.listen(${port},()=>console.log('${nombre} corriendo en ${port}'));
`);
}

async function startRepo(repo,index){
  const ruta = path.join(BASE,repo);
  const port = getPort(index);

  crearProyecto(repo,port);

  await run('npm install',ruta);

  if(procesos[repo]){
    return {msg:"ya activo",port};
  }

  const p = exec('node server.js',{cwd:ruta});
  procesos[repo]=p.pid;

  guardarEstado();

  return {msg:"iniciado",port};
}

async function stopRepo(repo){
  if(!procesos[repo]){
    return {msg:"no activo"};
  }

  await run(`kill -9 ${procesos[repo]}`,BASE);
  delete procesos[repo];

  guardarEstado();

  return {msg:"detenido"};
}

function estado(){
  const repos = fs.existsSync(BASE)?fs.readdirSync(BASE):[];
  return repos.map((r,i)=>({
    repo:r,
    puerto:getPort(i),
    activo:procesos[r]?true:false
  }));
}

cargarEstado();

app.get('/api/status',(req,res)=>res.json(estado()));

app.get('/api/start/:repo',async(req,res)=>{
  const repos = fs.readdirSync(BASE);
  const i = repos.indexOf(req.params.repo);
  const r = await startRepo(req.params.repo,i>=0?i:repos.length);
  res.json(r);
});

app.get('/api/stop/:repo',async(req,res)=>{
  const r = await stopRepo(req.params.repo);
  res.json(r);
});

app.use(express.static('public'));

app.listen(3000,()=>{
  console.log('🔥 FINAL en http://127.0.0.1:3000');
});
