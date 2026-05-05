const client = require('prom-client');
const express = require('express');
const os = require('os');
const app = express();

// --- LÓGICA DE CÁLCULO DE HARDWARE ---

function getCpuUsage() {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  cpus.forEach(core => {
    for (let type in core.times) {
      total += core.times[type];
    }
    idle += core.times.idle;
  });
  return Math.round(100 - (idle / total) * 100);
}

function getRamUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 100);
}

// --- CONFIGURACIÓN DE PROMETHEUS ---

// Métricas por defecto (GC, Heap, etc.)
client.collectDefaultMetrics({ prefix: 'dmr4_' });

// Gauges para el Dashboard
const carga = new client.Gauge({ 
  name: 'node_load', 
  help: 'Porcentaje de uso de CPU (0-100)' 
});

const memoria = new client.Gauge({ 
  name: 'node_memory', 
  help: 'Porcentaje de uso de RAM (0-100)' 
});

const procesos = new client.Gauge({ 
  name: 'node_processes', 
  help: 'Número de procesos activos en el nodo' 
});

// --- EXPOSICIÓN DE MÉTRICAS ---

app.get('/metrics', async (req, res) => {
  try {
    // Actualizamos los valores justo antes de que Prometheus los lea
    carga.set(getCpuUsage());
    memoria.set(getRamUsage());
    
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).send(err);
  }
});

const PORT = 9100;
app.listen(PORT, () => {
  console.log(`📊 Exporter DMR4 activo en puerto ${PORT}`);
});

module.exports = { carga, procesos, memoria };

