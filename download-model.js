#!/usr/bin/env node
/**
 * Script para descargar el modelo Gemma 4 desde HuggingFace
 * Guarda los archivos en la carpeta ./model/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const MODEL_ID = 'google/gemma-4-E2B-it-qat-mobile-transformers';
const HF_API_URL = `https://huggingface.co/api/models/${MODEL_ID}/tree/main`;
const BASE_DOWNLOAD_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`;

const MODEL_DIR = path.join(__dirname, 'model');

// Archivos requeridos del modelo
const REQUIRED_FILES = [
  'config.json',
  'generation_config.json',
  'model.safetensors',
  'preprocessor_config.json',
  'processor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'chat_template.jinja',
  '.gitattributes',
  'README.md'
];

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, {
      headers: {
        'User-Agent': 'webml-download/1.0'
      }
    }, (response) => {
      // Handle redirects: 301, 302, 307, 308
      if ([301, 302, 307, 308].includes(response.statusCode)) {
        // Resolve relative URLs to absolute
        const redirectUrl = response.headers.location.startsWith('http')
          ? response.headers.location
          : new URL(response.headers.location, url).toString();
        fetchJSON(redirectUrl).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https:') ? https : http;

    const request = client.get(url, {
      headers: {
        'User-Agent': 'webml-download/1.0'
      }
    }, (response) => {
      // Handle redirects: 301, 302, 307, 308
      if ([301, 302, 307, 308].includes(response.statusCode)) {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        // Resolve relative URLs to absolute
        const redirectUrl = response.headers.location.startsWith('http')
          ? response.headers.location
          : new URL(response.headers.location, url).toString();
        console.log(`   ↳ Redirect (${response.statusCode}) → ${redirectUrl.substring(0, 60)}...`);
        downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      let lastPercent = -1;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize) {
          const percent = Math.floor((downloaded / totalSize) * 100);
          if (percent !== lastPercent && percent % 10 === 0) {
            process.stdout.write(`\r  ${percent}% (${formatBytes(downloaded)} / ${formatBytes(totalSize)})`);
            lastPercent = percent;
          }
        }
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(''); // New line after progress
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });

    request.setTimeout(300000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(new Error('Download timeout'));
    });
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

async function downloadModel() {
  console.log('='.repeat(60));
  console.log('Descargando modelo Gemma 4 E2B (QAT Mobile)');
  console.log('Repositorio:', MODEL_ID);
  console.log('='.repeat(60));
  console.log('');

  // Crear directorio si no existe
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    console.log('✓ Directorio creado:', MODEL_DIR);
  } else {
    console.log('✓ Directorio existe:', MODEL_DIR);
  }

  const startTime = Date.now();
  let downloadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const filename of REQUIRED_FILES) {
    const destPath = path.join(MODEL_DIR, filename);
    const url = `${BASE_DOWNLOAD_URL}/${filename}`;

    // Verificar si ya existe
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      console.log(`\n⏭  ${filename} ya existe (${formatBytes(stats.size)})`);
      skippedCount++;
      continue;
    }

    console.log(`\n📥 Descargando: ${filename}`);
    console.log(`   URL: ${url}`);

    try {
      await downloadFile(url, destPath);
      const stats = fs.statSync(destPath);
      console.log(`   ✓ Completado (${formatBytes(stats.size)})`);
      downloadedCount++;
    } catch (err) {
      console.error(`   ✗ Error: ${err.message}`);
      errorCount++;
    }
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  console.log('');
  console.log('='.repeat(60));
  console.log('Resumen:');
  console.log(`  Descargados: ${downloadedCount}`);
  console.log(`  Saltados (ya existían): ${skippedCount}`);
  console.log(`  Errores: ${errorCount}`);
  console.log(`  Tiempo total: ${formatTime(elapsed)}`);
  console.log('='.repeat(60));

  if (errorCount === 0) {
    console.log('\n✓ Modelo listo para usar localmente');
    console.log('  Inicia el servidor: node server.js');
  }
}

// Ejecutar si se corre directamente
if (require.main === module) {
  downloadModel().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
}

module.exports = { downloadModel, MODEL_DIR };
