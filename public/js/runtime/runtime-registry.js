const RuntimeAdapter = require('./runtime-adapter');
const OnnxRuntime = require('./onnx-runtime');
const EndpointRuntime = require('./endpoint-runtime');

class RuntimeRegistry {
  constructor() {
    this.runtimes = new Map();
    this.availability = new Map();
    this.runtimeConfigs = new Map();

    // Registrar runtimes por defecto
    this.register('onnx-webgpu', OnnxRuntime, { backend: 'webgpu' });
    this.register('onnx-cpu', OnnxRuntime, { backend: 'cpu' });
    this.register('custom-endpoint', EndpointRuntime);

    // Todos disponibles por defecto
    this.runtimes.forEach((_, id) => {
      this.availability.set(id, { available: true, reason: null });
    });
  }

  register(id, RuntimeClass, config = {}) {
    this.runtimes.set(id, RuntimeClass);
    this.runtimeConfigs.set(id, config);
    this.availability.set(id, { available: true, reason: null });
  }

  getAvailableRuntimes() {
    const result = [];
    this.runtimes.forEach((RuntimeClass, id) => {
      const info = this.getRuntimeInfo(id);
      const availability = this.availability.get(id);
      result.push({
        id,
        name: info.name,
        description: info.description,
        available: availability?.available ?? true,
        unavailableReason: availability?.reason
      });
    });
    return result;
  }

  getRuntimeClass(id) {
    return this.runtimes.get(id);
  }

  getRuntimeInfo(id) {
    const RuntimeClass = this.runtimes.get(id);
    if (!RuntimeClass) return null;
    const config = this.runtimeConfigs.get(id) || {};
    const instance = new RuntimeClass(...Object.values(config));
    return instance.getInfo();
  }

  isAvailable(id) {
    return this.availability.get(id)?.available ?? false;
  }

  markUnavailable(id, reason) {
    this.availability.set(id, { available: false, reason });
  }

  updateAvailability(capabilities) {
    // Marcar onnx-webgpu como no disponible si no hay WebGPU
    if (capabilities.webgpu === false) {
      this.markUnavailable('onnx-webgpu', 'Tu navegador no soporta WebGPU');
    }
  }
}

module.exports = RuntimeRegistry;
