#!/usr/bin/env node
/**
 * Servidor local para Gemma 4 Chat con EJS
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { downloadModel, MODEL_DIR } = require('./download-model');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Servir archivos del modelo
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

// API: Model status
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
    size: totalSize,
    humanReadable: formatBytes(totalSize)
  });
});

// API: Download model
app.post('/api/download-model', async (req, res) => {
  res.json({ message: 'Download started. Check terminal for progress.' });
  try {
    await downloadModel();
  } catch (err) {
    console.error('Download error:', err);
  }
});

// Main route - Render EJS template
app.get('/', async (req, res) => {
  const status = await getModelStatus();
  res.render('index', {
    title: 'Gemma 4 Chat',
    modelAvailable: status.exists,
    modelSize: status.humanReadable
  });
});

async function getModelStatus() {
  const modelExists = fs.existsSync(path.join(MODEL_DIR, 'model.safetensors'));
  const tokenizerExists = fs.existsSync(path.join(MODEL_DIR, 'tokenizer.json'));
  const configExists = fs.existsSync(path.join(MODEL_DIR, 'config.json'));
  let totalSize = 0;
  if (modelExists) {
    totalSize = fs.statSync(path.join(MODEL_DIR, 'model.safetensors')).size;
  }
  return {
    exists: modelExists && tokenizerExists && configExists,
    size: totalSize,
    humanReadable: formatBytes(totalSize)
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Gemma 4 Chat - EJS Server');
  console.log('='.repeat(60));
  console.log(`URL: http://localhost:${PORT}`);
  console.log('');
  const modelExists = fs.existsSync(path.join(MODEL_DIR, 'model.safetensors'));
  if (modelExists) {
    const size = fs.statSync(path.join(MODEL_DIR, 'model.safetensors')).size;
    console.log('✓ Model:', formatBytes(size));
  } else {
    console.log('⚠ No model. Run: npm run download');
  }
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('='.repeat(60));
});

module.exports = app;
