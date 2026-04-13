const QRCode = require('qrcode');

const wallet = '3CThGZU6DA6CdRMeYqnW12rtpudL9TgQPFT7qqu4NJ84';

QRCode.toFile('./public/qr_dmr4.png', wallet, {
  width: 500,
  color: {
    dark: '#000000', // Negro
    light: '#ffffff' // Blanco
  }
}, function (err) {
  if (err) throw err;
  console.log('✅ QR generado con éxito en: ./public/qr_dmr4.png');
});
