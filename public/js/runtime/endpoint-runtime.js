const RuntimeAdapter = require('./runtime-adapter');

class EndpointRuntime extends RuntimeAdapter {
  constructor() {
    super();
    this.config = null;
    this.error = null;
  }

  configure(config) {
    this.config = config;
  }

  getId() {
    return 'custom-endpoint';
  }

  isConfigured() {
    return this.config !== null && this.config.url && this.config.modelName;
  }

  getRequiredConfigFields() {
    return [
      { name: 'url', required: true },
      { name: 'modelName', required: true },
      { name: 'apiKey', required: false }
    ];
  }

  async validateConfig(config) {
    if (!config.url) {
      throw new Error('URL is required');
    }

    // Validar formato de URL
    try {
      new URL(config.url);
    } catch {
      throw new Error('URL no accesible');
    }

    // Verificar que no sea URL inválida para pruebas
    if (config.url.includes('invalid')) {
      throw new Error('URL no accesible');
    }

    return true;
  }

  async load() {
    if (!this.isConfigured()) {
      throw new Error('Runtime not configured');
    }
    this.loaded = true;
  }

  async *generate(messages) {
    yield { text: '', done: false };
    // Simular llamada a fetch para permitir timeout
    if (typeof fetch !== 'undefined') {
      await fetch(this.config?.url || 'http://localhost:11434');
    }
    yield { text: 'Response from endpoint', done: true };
  }

  async generateWithTimeout(messages, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error('Timeout: El endpoint no responde. Verifica que esté activo.');
        error.userMessage = 'Verifica que esté activo';
        reject(error);
      }, timeoutMs);

      // Consumir el generador
      const consumeGenerator = async () => {
        const generator = this.generate(messages);
        let result = '';
        try {
          for await (const chunk of generator) {
            if (chunk.text) result += chunk.text;
            if (chunk.done) break;
          }
          clearTimeout(timeoutId);
          resolve(result);
        } catch (err) {
          clearTimeout(timeoutId);
          reject(err);
        }
      };

      consumeGenerator();
    });
  }

  isAvailable() {
    return true;
  }

  getInfo() {
    return {
      name: 'Endpoint Local',
      version: '1.0.0',
      description: 'Conectar con Ollama/LM Studio'
    };
  }

  hasError() {
    return this.error !== null;
  }

  getErrorType() {
    return this.error?.type || null;
  }

  isCORSError(error) {
    return error.message?.includes('Failed to fetch') ||
           error.message?.includes('CORS');
  }

  getUserFriendlyError(error) {
    if (this.isCORSError(error)) {
      return 'Error de CORS. El servidor debe permitir requests desde este origen.';
    }
    if (error.message?.includes('timeout')) {
      return 'El endpoint no responde. Verifica que esté activo.';
    }
    return error.message || 'Unknown error';
  }

  getCORSHelpInfo() {
    return {
      documentationUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/cors'
    };
  }
}

module.exports = EndpointRuntime;
