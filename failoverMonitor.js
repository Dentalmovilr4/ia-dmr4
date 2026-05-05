require('dotenv').config();
const Redis = require('ioredis');
const { alerta } = require('./bot'); // Importamos tu bot para avisarte al celular

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379
});

// Estado anterior para detectar cambios
let estadoPrevio = {
  primary: null,
  secondary: null
};

console.log("🕵️ DMR4 Failover Monitor Iniciado...");

async function monitorear() {
  try {
    // Consultamos el estado de las regiones en Redis
    const primary = await redis.get('region:primary');
    const secondary = await redis.get('region:secondary');

    const estadoActual = {
      primary: primary || 'CAÍDO 🔴',
      secondary: secondary || 'CAÍDO 🔴'
    };

    // 📊 Mostrar en consola de Termux
    console.clear();
    console.log("====================================");
    console.log("📡 MONITOR DE REGIONES DMR4");
    console.log(`⏰ ${new Date().toLocaleString()}`);
    console.log("====================================");
    console.log(`🥇 Región Primaria:  ${estadoActual.primary}`);
    console.log(`🥈 Región Secundaria: ${estadoActual.secondary}`);
    console.log("====================================");

    // 🚨 Lógica de Alertas Inteligentes
    if (estadoPrevio.primary && !primary) {
      await alerta('error', '⚠️ ¡ALERTA! La Región Primaria se ha desconectado. Iniciando Failover...');
    }

    if (!estadoPrevio.primary && primary) {
      await alerta('success', '✅ Región Primaria recuperada y activa.');
    }

    if (primary && secondary && primary === secondary) {
      await alerta('warning', '⚠️ Conflicto detectado: Ambas regiones reclaman ser Primarias.');
    }

    // Actualizar historial
    estadoPrevio = { primary, secondary };

  } catch (err) {
    console.error("❌ Error de conexión con Redis:", err.message);
  }
}

// Ejecutar cada 5 segundos
setInterval(monitorear, 5000);

// Ejecución inicial
monitorear();
