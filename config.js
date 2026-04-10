const path = require('path');

module.exports = {
  BASE: process.env.BASE_DIR || '/data/data/com.termux/files/home/proyectos-dmr4',
  DB: path.join(__dirname, 'estado.json'),
  PANEL_PORT: Number(process.env.PANEL_PORT || 3000),
  BASE_PORT: Number(process.env.BASE_PORT || 3100),
  MINT_DMR4: process.env.MINT_DRM4 || '3CThGZU6DA6CdRMeYqnW12rtpudL9TgQPFT7qqu4NJ84',
};
