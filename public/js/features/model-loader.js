/**
 * Feature: Model Loader
 * Maneja la carga de modelos: local, CDN y Ollama endpoint
 */

import { formatBytes } from '../utils.js';

export class ModelLoader {
  constructor(modelManager) {
    this.model = modelManager;
  }

  async initialize(selectedRuntime, runtimeJustChanged) {
    console.log('initializeModel called');

    // Si es cambio manual a custom-endpoint, mostrar selector Ollama
    if (selectedRuntime === 'custom-endpoint' && runtimeJustChanged) {
      console.log('Calling initializeOllamaModel (manual change detected)');
      sessionStorage.removeItem('runtimeJustChanged');
      return this.initializeOllama();
    }

    // Si está configurado para Endpoint pero no fue cambio manual
    if (selectedRuntime === 'custom-endpoint' && !runtimeJustChanged) {
      const savedOllamaModel = localStorage.getItem('ollamaSelectedModel');
      if (savedOllamaModel) {
        console.log('Loading saved Ollama model:', savedOllamaModel);
        return this.loadOllamaModel(savedOllamaModel);
      }
      return this.showOllamaActivationButton();
    }

    // Carga de modelo local
    return this.loadLocalModel();
  }

  async loadLocalModel() {
    const checkingState = document.getElementById('checking-state');
    const loadingLocalState = document.getElementById('loading-local-state');
    const cdnLoadState = document.getElementById('cdn-load-state');
    const emptySubtitle = document.getElementById('empty-subtitle');
    const emptyState = document.getElementById('empty-state');

    if (emptySubtitle) emptySubtitle.classList.add('hidden');
    if (checkingState) checkingState.classList.remove('hidden');

    try {
      // Clear any existing Ollama model before loading ONNX
      this.model.model = null;
      this.model.ollamaModel = null;

      const status = await this.model.checkLocalStatus();
      if (checkingState) checkingState.classList.add('hidden');

      if (status.exists) {
        if (loadingLocalState) loadingLocalState.classList.remove('hidden');
        await this.model.loadFromLocal((event) => this.handleProgress(event));
        return { success: true, source: 'local' };
      } else {
        // No local model - start automatic download
        return this.autoDownloadModel();
      }
    } catch (err) {
      console.error('Initialization error:', err);
      if (checkingState) checkingState.classList.add('hidden');

      // Check if it's a WebGPU error
      const isWebGPUError = err.message?.includes('WebGPU') ||
                           err.message?.includes('adapter') ||
                           err.message?.includes('No WebGPU');

      if (isWebGPUError) {
        // Show WebGPU-specific error with CDN fallback
        return this.showWebGPUError(err);
      }

      // Generic error - show download options
      if (emptySubtitle) emptySubtitle.classList.remove('hidden');
      if (cdnLoadState) cdnLoadState.classList.remove('hidden');
      return { success: false, error: err };
    }
  }

  showWebGPUError(error) {
    const emptyState = document.getElementById('empty-state');

    if (emptyState) {
      emptyState.innerHTML = `
        <h2>⚠️ WebGPU Error</h2>
        <p style="color: #ff7a6b; font-size: 14px; margin-bottom: 16px;">
          ${error.message || 'WebGPU is not available'}
        </p>
        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">
          Your browser cannot access the GPU. Try:
        </p>
        <ul style="color: var(--text-secondary); font-size: 13px; text-align: left; margin-bottom: 16px; max-width: 400px;">
          <li>Use Chrome 113+ or Edge 113+</li>
          <li>Enable WebGPU flags if needed</li>
          <li>Load from CDN as fallback</li>
        </ul>
        <button class="load-model-btn" id="load-cdn-btn" style="margin-bottom: 8px;">
          Load from CDN (slower)
        </button>
        <button class="load-model-btn" id="retry-local-btn" style="background: transparent; border: 1px solid var(--border); color: var(--text-secondary);">
          Retry Local Model
        </button>
      `;

      // Attach event listeners
      const cdnBtn = document.getElementById('load-cdn-btn');
      const retryBtn = document.getElementById('retry-local-btn');

      if (cdnBtn) {
        cdnBtn.addEventListener('click', async () => {
          const result = await this.downloadFromCDN();
          if (result.success) {
            window.dispatchEvent(new CustomEvent('modelLoadedFromCDN'));
          }
        });
      }

      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          window.location.reload();
        });
      }
    }

    return { success: false, error: error, webgpuError: true };
  }

  async autoDownloadModel() {
    const emptyState = document.getElementById('empty-state');
    const cdnLoadState = document.getElementById('cdn-load-state');

    // Hide options and show downloading state
    if (cdnLoadState) cdnLoadState.classList.add('hidden');

    // Create downloading UI
    if (emptyState) {
      emptyState.innerHTML = `
        <h2>Gemma 4 E2B</h2>
        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">
          Downloading model for local use (~2.3GB)...
        </p>
        <div class="progress-bar" style="display: block; margin: 20px auto; width: 300px;">
          <div class="progress-fill" id="download-progress-fill" style="width: 0%;"></div>
        </div>
        <p id="download-progress-text" style="color: var(--accent); font-size: 14px;">Starting download...</p>
        <p id="download-status-text" style="color: var(--text-secondary); font-size: 12px; margin-top: 8px;"></p>
      `;
    }

    // Poll for download progress
    const progressFill = document.getElementById('download-progress-fill');
    const progressText = document.getElementById('download-progress-text');
    const statusText = document.getElementById('download-status-text');

    // Start polling for status
    const pollInterval = setInterval(async () => {
      try {
        const status = await this.model.checkLocalStatus();
        if (status.exists && status.size > 0) {
          // Model exists - check if download is complete
          const expectedSize = 2.3 * 1024 * 1024 * 1024; // ~2.3GB
          const progress = Math.min((status.size / expectedSize) * 100, 99);

          if (progressFill) progressFill.style.width = progress + '%';
          if (progressText) progressText.textContent = `Downloaded: ${status.humanReadable}`;
          if (statusText) statusText.textContent = 'Downloading to server...';
        }
      } catch (e) {
        console.log('Poll error (non-critical):', e);
      }
    }, 2000);

    try {
      // Trigger server-side download
      const response = await fetch('/api/download-model', { method: 'POST' });
      const result = await response.json();

      clearInterval(pollInterval);

      if (statusText) statusText.textContent = 'Download complete! Reloading...';
      if (progressFill) progressFill.style.width = '100%';

      // Give user a moment to see completion, then reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);

      return { success: false, downloading: true };
    } catch (err) {
      clearInterval(pollInterval);
      console.error('Auto-download error:', err);

      // Show error and fallback options
      if (emptyState) {
        emptyState.innerHTML = `
          <h2>Gemma 4 E2B</h2>
          <p style="color: #ff7a6b; font-size: 14px; margin-bottom: 16px;">
            Download failed: ${err.message || 'Unknown error'}
          </p>
          <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">
            You can try alternative options:
          </p>
          <button class="load-model-btn" id="retry-download-btn" style="margin-bottom: 8px;">
            Retry Download
          </button>
          <button class="load-model-btn" id="load-cdn-btn" style="background: transparent; border: 1px solid var(--border); color: var(--text-secondary);">
            Load from CDN (slower)
          </button>
        `;
      }

      // Re-attach event listeners
      const retryBtn = document.getElementById('retry-download-btn');
      const cdnBtn = document.getElementById('load-cdn-btn');

      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.autoDownloadModel());
      }
      if (cdnBtn) {
        cdnBtn.addEventListener('click', async () => {
          const result = await this.downloadFromCDN();
          if (result.success) {
            window.dispatchEvent(new CustomEvent('modelLoadedFromCDN'));
          }
        });
      }

      return { success: false, error: err };
    }
  }

  handleProgress(event) {
    if (event.status === 'weights' && event.fraction) {
      const fill = document.getElementById('local-progress-fill');
      const text = document.getElementById('local-progress-text');
      if (fill) fill.style.width = (event.fraction * 100) + '%';
      if (text) {
        const loaded = event.loaded || 0;
        const total = event.total || 0;
        text.textContent = `Loading: ${formatBytes(loaded)} / ${formatBytes(total)}`;
      }
    }
  }

  async initializeOllama() {
    const checkingState = document.getElementById('checking-state');
    const ollamaState = document.getElementById('ollama-state');
    const emptyState = document.getElementById('empty-state');
    const selector = document.getElementById('ollama-model-selector');
    const status = document.getElementById('ollama-status');

    if (checkingState) checkingState.classList.add('hidden');
    if (emptyState) emptyState.style.display = 'none';
    if (ollamaState) ollamaState.classList.remove('hidden');

    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) throw new Error('Ollama not responding');

      const data = await response.json();
      const models = data.models || [];

      if (selector) {
        selector.innerHTML = '';
        if (models.length === 0) {
          selector.innerHTML = '<option>No models found</option>';
          if (status) status.textContent = 'Install models with: ollama pull <model>';
        } else {
          models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            selector.appendChild(option);
          });
          if (status) status.textContent = `${models.length} model(s) available`;
        }

        selector.addEventListener('change', async (e) => {
          if (!e.target.value) return;
          selector.disabled = true;
          if (status) status.textContent = `Loading ${e.target.value}...`;

          try {
            // Limpiar modelo anterior antes de cargar nuevo
            console.log('Clearing previous model before loading Ollama:', e.target.value);
            this.model.model = null;
            this.model.ollamaModel = null;
            await this.model.initOllamaRuntime(e.target.value);
            localStorage.setItem('ollamaSelectedModel', e.target.value);
            if (ollamaState) ollamaState.classList.add('hidden');
            // Trigger chat show through custom event
            window.dispatchEvent(new CustomEvent('ollamaModelLoaded', { detail: { model: e.target.value } }));
          } catch (err) {
            console.error('Failed to load Ollama model:', err);
            if (status) status.textContent = 'Error: ' + err.message;
            selector.disabled = false;
          }
        });
      }

      // Retornar que estamos esperando selección del usuario
      return { success: false, waitingForSelection: true };

    } catch (err) {
      console.error('Ollama connection error:', err);
      if (selector) {
        selector.innerHTML = '<option>Ollama not available</option>';
        selector.disabled = true;
      }
      if (status) {
        status.textContent = 'Make sure Ollama is running on localhost:11434';
      }
      return { success: false, error: err.message };
    }
  }

  async loadOllamaModel(modelName) {
    const emptyState = document.getElementById('empty-state');
    const chatContainer = document.getElementById('chat-container');

    try {
      // Clear any existing model (ONNX) before loading Ollama
      this.model.model = null;
      await this.model.initOllamaRuntime(modelName);
      if (emptyState) emptyState.style.display = 'none';
      if (chatContainer) chatContainer.style.display = 'block';

      // Actualizar badge
      const badgeModelVariant = document.getElementById('badge-model-variant');
      if (badgeModelVariant) {
        badgeModelVariant.textContent = modelName.split(':')[0];
      }

      return { success: true, model: modelName };
    } catch (err) {
      console.error('Failed to load Ollama model:', err);
      return this.showOllamaError(modelName);
    }
  }

  showOllamaActivationButton() {
    const emptySubtitle = document.getElementById('empty-subtitle');
    const emptyState = document.getElementById('empty-state');

    console.log('Endpoint mode saved but no model selected, showing activation button');
    if (emptySubtitle) emptySubtitle.classList.add('hidden');

    if (emptyState) {
      emptyState.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <h2>Ollama Local Endpoint</h2>
          <p style="color: var(--text-secondary); margin: 20px 0;">
            Runtime configurado para usar Endpoint Local
          </p>
          <button id="activate-ollama-btn" class="load-model-btn" style="margin-top: 20px;">
            Seleccionar modelo de Ollama
          </button>
        </div>
      `;

      const activateBtn = document.getElementById('activate-ollama-btn');
      if (activateBtn) {
        activateBtn.addEventListener('click', () => {
          sessionStorage.setItem('runtimeJustChanged', 'true');
          location.reload();
        });
      }
    }

    return { success: false, waitingForSelection: true };
  }

  showOllamaError(modelName) {
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
      emptyState.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <h2>Error al cargar modelo</h2>
          <p style="color: var(--text-secondary); margin: 20px 0;">
            No se pudo cargar el modelo ${modelName}
          </p>
          <button id="retry-ollama-btn" class="load-model-btn" style="margin-top: 20px;">
            Reintentar
          </button>
        </div>
      `;

      const retryBtn = document.getElementById('retry-ollama-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          sessionStorage.setItem('runtimeJustChanged', 'true');
          location.reload();
        });
      }
    }
    return { success: false, error: 'Failed to load model' };
  }

  async downloadFromCDN() {
    const cdnLoadState = document.getElementById('cdn-load-state');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const emptySubtitle = document.getElementById('empty-subtitle');

    if (cdnLoadState) cdnLoadState.classList.add('hidden');
    if (emptySubtitle) emptySubtitle.classList.add('hidden');
    if (progressBar) progressBar.style.display = 'block';
    if (progressText) progressText.textContent = 'Loading model from CDN...';

    try {
      await this.model.loadFromCDN((event) => {
        try {
          const fill = document.getElementById('progress-fill');
          const text = document.getElementById('progress-text');

          if (event.status === 'weights' && event.fraction) {
            if (fill) fill.style.width = (event.fraction * 100) + '%';
            if (text) {
              const loaded = event.loaded || 0;
              const total = event.total || 0;
              if (total > 0) {
                text.textContent = `${formatBytes(loaded)} / ${formatBytes(total)}`;
              } else {
                text.textContent = `Loading: ${Math.round(event.fraction * 100)}%`;
              }
            }
          }
        } catch (progressErr) {
          console.log('Progress update error (non-critical):', progressErr);
        }
      });

      return { success: true, source: 'cdn' };
    } catch (err) {
      console.error('CDN load error:', err);

      // Restore UI on error so user can try again
      if (progressBar) progressBar.style.display = 'none';
      if (cdnLoadState) cdnLoadState.classList.remove('hidden');
      if (emptySubtitle) emptySubtitle.classList.remove('hidden');

      // Show error message in progress text area
      const text = document.getElementById('progress-text');
      if (text) {
        text.textContent = `Error: ${err.message || 'Failed to load from CDN'}`;
        text.style.color = '#ff7a6b';
      }

      return { success: false, error: err };
    }
  }

  async downloadModel() {
    const btn = document.getElementById('download-model-btn');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = 'Downloading... Check terminal';

    try {
      const response = await fetch('/api/download-model', { method: 'POST' });
      const result = await response.json();
      return { success: true, message: result.message };
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = 'Download Model (~2.3GB)';
      return { success: false, error: err };
    }
  }
}
