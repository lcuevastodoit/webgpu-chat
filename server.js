#!/usr/bin/env node
/**
 * Servidor local para Gemma 4 Chat
 * Sirve la app y los archivos del modelo descargado
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { downloadModel, MODEL_DIR } = require('./download-model');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Servir archivos del modelo con CORS habilitado
app.use('/model', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}, express.static(MODEL_DIR));

// Endpoint para verificar si el modelo existe localmente
app.get('/api/model-status', (req, res) => {
  const modelExists = fs.existsSync(path.join(MODEL_DIR, 'model.safetensors'));
  const tokenizerExists = fs.existsSync(path.join(MODEL_DIR, 'tokenizer.json'));
  const configExists = fs.existsSync(path.join(MODEL_DIR, 'config.json'));

  let totalSize = 0;
  if (modelExists) {
    totalSize = fs.statSync(path.join(MODEL_DIR, 'model.safetensors')).size;
  }

  res.json({
    exists: modelExists && tokenizerExists && configExists,
    modelExists,
    tokenizerExists,
    configExists,
    modelPath: MODEL_DIR,
    size: totalSize,
    humanReadable: formatBytes(totalSize)
  });
});

// Endpoint para descargar el modelo
app.post('/api/download-model', async (req, res) => {
  res.json({ message: 'Iniciando descarga...' });

  try {
    await downloadModel();
    console.log('\n✓ Descarga completada');
  } catch (err) {
    console.error('\n✗ Error en descarga:', err);
  }
});

// Ruta principal - sirve index.html modificado
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Insertar script para detectar modelo local antes de cualquier otro script
  const localModelCheck = `
    <script>
      // Configuración del modelo local vs CDN
      window.MODEL_CONFIG = {
        localBaseUrl: 'http://localhost:${PORT}/model',
        cdnBaseUrl: 'https://huggingface.co/google/gemma-4-E2B-it-qat-mobile-transformers/resolve/main',
        useLocal: false // Se determina dinámicamente
      };

      // Verificar disponibilidad del modelo local
      (async function checkLocalModel() {
        try {
          const response = await fetch('/api/model-status');
          const status = await response.json();
          window.MODEL_CONFIG.useLocal = status.exists;
          window.MODEL_LOCAL_AVAILABLE = status.exists;
          console.log('Modelo local:', status.exists ? 'DISPONIBLE' : 'NO DISPONIBLE');
          if (status.exists) {
            console.log('Tamaño:', status.humanReadable);
          }
        } catch (e) {
          console.log('No se pudo verificar modelo local:', e);
          window.MODEL_LOCAL_AVAILABLE = false;
        }
      })();
    </script>
  `;

  // Insertar después del <head>
  html = html.replace('<head>', '<head>' + localModelCheck);

  res.send(html);
});

// Proxy para archivos del modelo desde CDN si no están localmente
app.get('/proxy-model/*path', async (req, res) => {
  const filePath = req.params.path;
  const localFile = path.join(MODEL_DIR, filePath);

  // Si existe localmente, servirlo
  if (fs.existsSync(localFile)) {
    return res.sendFile(localFile);
  }

  // Si no, redirigir al CDN
  const cdnUrl = `https://huggingface.co/google/gemma-4-E2B-it-qat-mobile-transformers/resolve/main/${filePath}`;
  res.redirect(cdnUrl);
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Gemma 4 Chat - Servidor Local');
  console.log('='.repeat(60));
  console.log(`URL: http://localhost:${PORT}`);
  console.log('');

  // Verificar estado del modelo
  const modelExists = fs.existsSync(path.join(MODEL_DIR, 'model.safetensors'));
  if (modelExists) {
    const size = fs.statSync(path.join(MODEL_DIR, 'model.safetensors')).size;
    console.log('✓ Modelo local disponible:', formatBytes(size));
    console.log('  Ubicación:', MODEL_DIR);
  } else {
    console.log('⚠ Modelo no encontrado en:', MODEL_DIR);
    console.log('  Ejecuta: node download-model.js');
  }
  console.log('');
  console.log('Presiona Ctrl+C para detener');
  console.log('='.repeat(60));
});

module.exports = app;
