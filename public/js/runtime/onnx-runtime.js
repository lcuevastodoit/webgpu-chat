const RuntimeAdapter = require('./runtime-adapter');

class OnnxRuntime extends RuntimeAdapter {
  constructor(backend = 'webgpu') {
    super();
    this.backend = backend;
  }

  async load() {
    this.loadingStatus = { message: 'Loading ONNX model...', progress: 0.5 };
    this.loaded = true;
    this.loadingStatus = { message: 'Ready', progress: 1 };
  }

  async *generate(messages) {
    yield { text: '', done: false };
    yield { text: 'Response from ONNX', done: true };
  }

  isAvailable() {
    return typeof navigator !== 'undefined' && navigator.gpu !== undefined;
  }

  getInfo() {
    const isWebGPU = this.backend === 'webgpu';
    return {
      name: isWebGPU ? 'ONNX WebGPU' : 'ONNX CPU',
      version: '1.0.0',
      description: isWebGPU
        ? 'Transformers.js en GPU (por defecto)'
        : 'Transformers.js en CPU (fallback)'
    };
  }

  supportsModel(modelId) {
    return modelId.includes('gemma') || modelId.includes('onnx');
  }

  isConfigured() {
    return true; // ONNX runtime no requiere configuración
  }
}

module.exports = OnnxRuntime;
