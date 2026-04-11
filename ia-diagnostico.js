const { exec } = require('child_process');
const fs = require('fs');

// Función para que la IA analice fallos
async function analizarFallo(nombreRepo) {
    console.log(`🔍 Iniciando escaneo hacker en: ${nombreRepo}...`);
    
    // Comando para ver las últimas 20 líneas de error del proceso
    exec(`tail -n 20 /data/data/com.termux/files/home/proyectos-dmr4/${nombreRepo}/logs.txt`, (err, stdout, stderr) => {
        if (err) {
            console.log("❌ No se encontraron logs de error.");
            return;
        }
        
        console.log("🤖 IA DMR4 ANALIZANDO LOGS:");
        console.log(stdout);
        
        // Aquí podrías enviar 'stdout' a la API de Gemini para que te dé la solución
    });
}
