const { exec } = require('child_process');

console.log("🔄 Reiniciando DMR4...");

exec('pkill -f main.js', () => {
  exec('node main.js', (err) => {
    if (err) {
      console.error("❌ Error al reiniciar:", err.message);
    } else {
      console.log("✅ Sistema reiniciado correctamente");
    }
  });
});