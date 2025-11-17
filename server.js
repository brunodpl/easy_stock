const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar headers para mejor rendimiento
app.use((req, res, next) => {
  // Cache para assets estáticos (1 día)
  if (req.url.match(/\.(css|js|svg|json)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Servir archivos estáticos
app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filepath) => {
    // Comprimir archivos de texto
    if (filepath.endsWith('.html') || filepath.endsWith('.css') || filepath.endsWith('.js')) {
      res.setHeader('Content-Encoding', 'identity');
    }
  }
}));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Easy Stock - Sistema de Gestión de Almacén`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Error: El puerto ${PORT} ya está en uso.`);
    console.log('💡 Intenta usar otro puerto con: PORT=3002 npm start');
  } else {
    console.error('❌ Error al iniciar el servidor:', err);
  }
});
