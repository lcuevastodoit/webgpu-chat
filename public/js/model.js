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

      // Cargar desde el servidor local en lugar de CDN
      const localModelUrl = `${window.location.origin}/model`;
      this.model = await Gemma4Mobile.load(localModelUrl, { onProgress });
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

  async initOllamaRuntime(modelName) {
    // Store Ollama model info for use in generation
    this.ollamaModel = modelName;
    const self = this;

    this.model = {
      // Create a wrapper that mimics the Gemma4Mobile interface
      generate: async function*(messages, options) {
        const response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages: messages,
            stream: true
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                fullText += data.message.content;
                // Yield in the format expected by the app: { text: full }
                yield { text: fullText };
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      },

      // Add generateSingle for non-streaming operations (like web search classification)
      generateSingle: async function(messages, options) {
        const response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages: messages,
            stream: false
          })
        });

        const data = await response.json();
        return data.message?.content || '';
      }
    };

    this.updateStatus('ready', `Ollama: ${modelName}`);
    return true;
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
    // This allows streaming tokens as they are generated
    return this.model.generate(messages, opts);
  }

  async generateSingle(messages, options = {}) {
    // Generate a single response (no streaming) for quick evaluations
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    // If the model has its own generateSingle (like Ollama), use it
    if (this.model.generateSingle) {
      return this.model.generateSingle(messages, options);
    }

    const opts = {
      maxNewTokens: 100, // Short response for evaluation
      ...options
    };

    const stream = this.model.generate(messages, opts);
    let fullText = '';

    for await (const { text } of stream) {
      fullText = text;
    }

    return fullText;
  }

  stop() {
    // Some model implementations support stopping
    if (this.model && this.model.stop) {
      this.model.stop();
    }
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
