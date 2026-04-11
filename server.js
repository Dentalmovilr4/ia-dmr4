const fs = require('fs');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');

const app = express();
const BASE = '/data/data/com.termux/files/home/proyectos-dmr4';
const DB = './estado.json';
// Tu contrato oficial de DRM4
const MINT_DRM4 = "3CThGZU6DA6CdRMeYqnW12rtpudL9TgQPFT7qqu4NJ84"; 

let procesos = {};

function guardarEstado(){
  fs.writeFileSync(DB, JSON.stringify(procesos));
}

function cargarEstado(){
  if(fs.existsSync(DB)){
    try {
      procesos = JSON.parse(fs.readFileSync(DB));
    } catch(e) { procesos = {}; }
  }
}

// --- NUEVA FUNCIÓN DE MONITOREO DE LIQUIDEZ ---
async function obtenerDatosToken() {
  try {
    // Consultamos la API de DexScreener para Solana
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MINT_DRM4}`);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      return {
        liquidez: pair.liquidity.usd,
        precio: pair.priceUsd,
        volumen: pair.volume.h24,
        url: pair.url
      };
    }
    return { liquidez: 0, precio: 0, msg: "Sin pool activo en Raydium/Orca" };
  } catch (error) {
    return { error: "Error de conexión con la red" };
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
  fs.mkdirSync(ruta, { recursive: true });

  fs.writeFileSync(path.join(ruta,'package.json'),JSON.stringify({
    name:nombre,
    version:"1.0.0",
    main:"server.js",
    dependencies:{ express:"^4.18.2", cors:"^2.8.5" }
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

  if(procesos[repo]){ return {msg:"ya activo",port}; }

  const p = exec('node server.js',{cwd:ruta});
  procesos[repo]=p.pid;
  guardarEstado();
  return {msg:"iniciado",port};
}

async function stopRepo(repo){
  if(!procesos[repo]){ return {msg:"no activo"}; }
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

// --- RUTAS API ---
app.get('/api/status',(req,res)=>res.json(estado()));

// Nueva ruta para que el panel frontal vea la liquidez
app.get('/api/liquidez', async (req, res) => {
  const info = await obtenerDatosToken();
  res.json(info);
});

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
  console.log('🔥 IA DMR4 FINAL en http://127.0.0.1:3000');
});

