class RuntimeAdapter {
  constructor() {
    this.loaded = false;
    this.loadingStatus = { message: 'Not loaded', progress: 0 };
    this.error = null;
  }

  setError(errorType) {
    this.error = { type: errorType };
  }

  hasError() {
    return this.error !== null;
  }

  getErrorType() {
    return this.error?.type || null;
  }

  getMetrics() {
    return {
      loadTime: this.loadTime || 0,
      memoryUsed: 0
    };
  }

  supportsModel(modelId) {
    return true; // Por defecto, asumir que soporta
  }

  async load() {
    throw new Error('Method load() must be implemented by subclass');
  }

  async *generate(messages) {
    throw new Error('Method generate() must be implemented by subclass');
  }

  async unload() {
    this.loaded = false;
    this.loadingStatus = { message: 'Not loaded', progress: 0 };
  }

  isAvailable() {
    throw new Error('Method isAvailable() must be implemented by subclass');
  }

  getInfo() {
    throw new Error('Method getInfo() must be implemented by subclass');
  }

  isLoaded() {
    return this.loaded;
  }

  getLoadingStatus() {
    return this.loadingStatus;
  }
}

module.exports = RuntimeAdapter;
