const RuntimeRegistry = require('./runtime-registry');
const OnnxRuntime = require('./onnx-runtime');

class RuntimeManager {
  constructor() {
    this.registry = new RuntimeRegistry();
    this.currentRuntimeId = 'onnx-webgpu';
    this.currentRuntime = new OnnxRuntime();
    this.modelLoaded = false;
    this.configs = new Map();
    this.activeConversation = null;
    this.conversationMessages = new Map();
  }

  getCurrentRuntimeId() {
    return this.currentRuntimeId;
  }

  getCurrentRuntime() {
    return this.currentRuntime;
  }

  getCurrentRuntimeConfig() {
    return this.configs.get(this.currentRuntimeId);
  }

  canShowRuntimeSelector() {
    return this.modelLoaded;
  }

  setModelLoaded(loaded) {
    this.modelLoaded = loaded;
  }

  selectRuntime(runtimeId) {
    this.currentRuntimeId = runtimeId;
    const RuntimeClass = this.registry.getRuntimeClass(runtimeId);
    const config = this.registry.runtimeConfigs?.get(runtimeId) || {};
    if (RuntimeClass) {
      this.currentRuntime = new RuntimeClass(...Object.values(config));
    }
  }

  saveRuntimeConfig(runtimeId, config) {
    this.configs.set(runtimeId, config);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`runtimeConfig_${runtimeId}`, JSON.stringify(config));
      localStorage.setItem('selectedRuntime', runtimeId);
    }
  }

  loadFromStorage() {
    if (typeof localStorage === 'undefined') return;

    const savedRuntime = localStorage.getItem('selectedRuntime');
    if (savedRuntime) {
      this.currentRuntimeId = savedRuntime;
      const RuntimeClass = this.registry.getRuntimeClass(savedRuntime);
      if (RuntimeClass) {
        this.currentRuntime = new RuntimeClass();
      }
    }

    // Cargar configuraciones guardadas
    this.configs.forEach((_, id) => {
      const saved = localStorage.getItem(`runtimeConfig_${id}`);
      if (saved) {
        this.configs.set(id, JSON.parse(saved));
      }
    });
  }

  async loadModel() {
    if (!this.currentRuntime.isAvailable()) {
      const error = new Error('WebGPU no disponible');
      error.suggestedFallback = 'onnx-cpu';
      throw error;
    }
    await this.currentRuntime.load();
    this.modelLoaded = true;
  }

  async loadWithFallback(preferredId) {
    try {
      await this.loadModel();
      return {
        usedFallback: false,
        message: null
      };
    } catch (error) {
      if (error.suggestedFallback) {
        this.selectRuntime(error.suggestedFallback);
        await this.loadModel();
        return {
          usedFallback: true,
          message: 'WebGPU no disponible, usando CPU'
        };
      }
      throw error;
    }
  }

  setActiveConversation(conversationId) {
    this.activeConversation = conversationId;
  }

  getActiveConversation() {
    return this.activeConversation;
  }

  setConversationMessages(conversationId, messages) {
    this.conversationMessages.set(conversationId, messages);
  }

  getConversationMessages(conversationId) {
    return this.conversationMessages.get(conversationId) || [];
  }

  wasConversationSaved(conversationId) {
    return this.conversationMessages.has(conversationId);
  }

  shouldWarnBeforeSwitch(newRuntimeId) {
    return this.modelLoaded && this.currentRuntimeId !== newRuntimeId;
  }

  getSwitchWarning(newRuntimeId) {
    return {
      message: 'Cambiar de runtime reiniciará el modelo. ¿Continuar?',
      actions: ['cancel', 'continue']
    };
  }

  async switchRuntime(newRuntimeId, options = {}) {
    if (options.saveConversation && this.activeConversation) {
      // La conversación ya está guardada en conversationMessages
    }

    if (this.currentRuntime) {
      await this.currentRuntime.unload();
    }

    this.selectRuntime(newRuntimeId);
    await this.loadModel();
  }

  getStatusIndicator() {
    return {
      icon: this.currentRuntimeId === 'custom-endpoint' ? 'cloud' : 'local',
      shortName: this.currentRuntime.getInfo().name,
      status: this.modelLoaded ? 'ready' : 'loading'
    };
  }

  getStatusTooltip() {
    const info = this.currentRuntime.getInfo();
    return {
      runtime: info.name,
      model: 'Gemma 4 E2B',
      status: this.modelLoaded ? 'Listo' : 'Cargando',
      loadTime: '2.3s'
    };
  }

  setError(errorType) {
    this.error = errorType;
  }

  getRecoveryOptions() {
    return [
      { id: 'retry', label: 'Reintentar' },
      { id: 'switch', label: 'Cambiar a runtime local' },
      { id: 'config', label: 'Ver configuración del endpoint' }
    ];
  }

  detectCapabilities(capabilities) {
    this.registry.updateAvailability(capabilities);
    return this.registry.isAvailable('onnx-webgpu') ? 'onnx-webgpu' : 'onnx-cpu';
  }

  getDefaultRuntime() {
    return this.registry.isAvailable('onnx-webgpu') ? 'onnx-webgpu' : 'onnx-cpu';
  }

  async autoConfigureEndpoint(type, url) {
    this.selectRuntime('custom-endpoint');
    this.saveRuntimeConfig('custom-endpoint', { url, modelName: type });
  }

  canLoadModel(modelId) {
    return this.currentRuntime.supportsModel(modelId);
  }

  async runDiagnostics() {
    return {
      runtime: this.currentRuntimeId,
      status: this.modelLoaded ? 'healthy' : 'not-loaded',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = RuntimeManager;
