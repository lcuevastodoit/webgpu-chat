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

    if (emptySubtitle) emptySubtitle.classList.add('hidden');
    if (checkingState) checkingState.classList.remove('hidden');

    try {
      const status = await this.model.checkLocalStatus();
      if (checkingState) checkingState.classList.add('hidden');

      if (status.exists) {
        if (loadingLocalState) loadingLocalState.classList.remove('hidden');
        await this.model.loadFromLocal((event) => this.handleProgress(event));
        return { success: true, source: 'local' };
      } else {
        if (emptySubtitle) emptySubtitle.classList.remove('hidden');
        if (cdnLoadState) cdnLoadState.classList.remove('hidden');
        return { success: false, needsDownload: true };
      }
    } catch (err) {
      console.error('Initialization error:', err);
      if (checkingState) checkingState.classList.add('hidden');
      if (emptySubtitle) emptySubtitle.classList.remove('hidden');
      if (cdnLoadState) cdnLoadState.classList.remove('hidden');
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
    const emptySubtitle = document.getElementById('empty-subtitle');

    if (cdnLoadState) cdnLoadState.classList.add('hidden');
    if (emptySubtitle) emptySubtitle.classList.add('hidden');
    if (progressBar) progressBar.style.display = 'block';

    try {
      await this.model.loadFromCDN((event) => {
        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');

        if (event.status === 'weights' && event.fraction) {
          if (fill) fill.style.width = (event.fraction * 100) + '%';
          if (text) {
            const loaded = event.loaded || 0;
            const total = event.total || 0;
            text.textContent = `${formatBytes(loaded)} / ${formatBytes(total)}`;
          }
        }
      });

      return { success: true, source: 'cdn' };
    } catch (err) {
      console.error('CDN load error:', err);
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
