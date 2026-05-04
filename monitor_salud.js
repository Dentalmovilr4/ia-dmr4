const os = require('os');
const axios = require('axios');

async function reportarSalud() {
  const ramLibre = os.freemem();
  const ramTotal = os.totalmem();
  const usoRam = ((ramTotal - ramLibre) / ramTotal) * 100;
  
  // Promedio de carga (ajustado a los núcleos de tu celular)
  const cargaCpu = (os.loadavg()[0] * 100) / os.cpus().length;

  const metrica = {
    id: os.hostname() || 'Oppo-A57-Cesar',
    cpu: Math.min(cargaCpu, 100).toFixed(2),
    ram: usoRam.toFixed(2),
    timestamp: new Date().toISOString()
  };

  try {
    // Aquí usamos el puerto de tu API que vimos en PM2 (3000)
    await axios.post('http://localhost:3000/api/metrics', metrica);
    console.log(`✅ Reporte enviado: CPU ${metrica.cpu}% | RAM ${metrica.ram}%`);
  } catch (error) {
    console.error('❌ Error al conectar con el API de DMR4');
  }
}

// Reportar cada 5 segundos
setInterval(reportarSalud, 5000);
