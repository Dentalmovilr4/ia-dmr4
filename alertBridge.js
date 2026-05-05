require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { alerta } = require('./bot'); // Tu integración con el bot DMR4

const app = express();
app.use(bodyParser.json());

/**
 * Endpoint de Webhook para Alertmanager
 */
app.post('/alert', async (req, res) => {
  try {
    const alerts = req.body.alerts || [];

    if (alerts.length === 0) {
      return res.sendStatus(200);
    }

    console.log(`🔔 Procesando ${alerts.length} alertas entrantes...`);

    for (const a of alerts) {
      // Definimos el icono según la severidad
      const icon = a.status === 'resolved' ? '✅' : '🚨';
      const statusText = a.status === 'resolved' ? 'SOLUCIONADO' : 'ACTIVADA';

      // Construcción del mensaje con formato HTML para el bot
      const msg = `
${icon} <b>ALERTA ${statusText}: ${a.labels.alertname}</b>

<b>Resumen:</b> ${a.annotations.summary || 'Sin resumen'}
<b>Descripción:</b> ${a.annotations.description || 'Sin descripción'}
<b>Severidad:</b> <code>${a.labels.severity || 'critical'}</code>
<b>Nodo:</b> <code>${a.labels.instance || 'Clúster DMR4'}</code>
      `;

      // Enviamos al bot (usando la severidad de la alerta para el tipo de log)
      await alerta(a.labels.severity || 'warning', msg);
    }

    res.status(200).send({ status: 'sent' });

  } catch (err) {
    console.error("❌ Error en el bridge de alertas:", err.message);
    res.status(500).send(err.message);
  }
});

// Puerto de escucha (Asegúrate de que coincida con el config de Alertmanager)
const PORT = process.env.ALERT_BRIDGE_PORT || 3001;

app.listen(PORT, () => {
  console.log(`📡 Alert Bridge DMR4 activo en el puerto ${PORT}`);
  console.log(`🔗 Webhook URL: http://alert-bridge:${PORT}/alert`);
});
