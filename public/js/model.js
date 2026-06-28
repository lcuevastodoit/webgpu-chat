// Model management (Gemma 4)

export class ModelManager {
  constructor() {
    this.model = null;
    this.isLoading = false;
    this.elements = {};
  }

  bindElements(elements) {
    this.elements = elements;
  }

  get isReady() {
    return !!this.model;
  }

  async checkLocalStatus() {
    try {
      const response = await fetch('/api/model-status');
      return await response.json();
    } catch (e) {
      console.log('Server not available:', e);
      return { exists: false };
    }
  }

  async loadFromLocal(onProgress) {
    if (this.isLoading || this.model) return;

    this.isLoading = true;
    this.updateStatus('loading', 'Loading from local...');

    try {
      // Dynamic import for Gemma4Mobile
      const { Gemma4Mobile } = await import(
        'https://webml-community-gemma-4-webgpu-kernels.static.hf.space/gemma-4-e2b.js'
      );

      this.model = await Gemma4Mobile.load(null, { onProgress });
      await this.model.warmup();

      this.updateStatus('ready', 'Ready');
      return true;
    } catch (err) {
      console.error('Error loading local model:', err);
      this.updateStatus('error', 'Failed to load');
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  async loadFromCDN(onProgress) {
    if (this.isLoading || this.model) return;

    this.isLoading = true;
    this.updateStatus('loading', 'Loading from CDN...');

    try {
      const { Gemma4Mobile } = await import(
        'https://webml-community-gemma-4-webgpu-kernels.static.hf.space/gemma-4-e2b.js'
      );

      this.model = await Gemma4Mobile.load(null, { onProgress });
      await this.model.warmup();

      this.updateStatus('ready', 'Ready');
      return true;
    } catch (err) {
      console.error('Error loading from CDN:', err);
      this.updateStatus('error', 'Failed to load');
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  generate(messages, options = {}) {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    const opts = {
      maxNewTokens: 4096,
      ...options
    };

    // Return the async generator directly - NO await here
    return this.model.generate(messages, opts);
  }

  updateStatus(type, message) {
    const { statusDot, statusText } = this.elements;
    if (statusDot) {
      statusDot.className = 'status-dot ' + type;
    }
    if (statusText) {
      statusText.textContent = message;
    }
  }
}

window.ModelManager = ModelManager;
