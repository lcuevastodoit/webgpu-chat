/**
 * Core: App Core
 * Clase App principal - orquestador de features
 */

import { ChatManager } from '../chat.js';
import { CommandsManager } from '../commands.js';
import { ModelManager } from '../model.js';
import { WebSearchManager } from '../features/web-search.js';
import { ModelLoader } from '../features/model-loader.js';
import { ChatController } from '../features/chat-controller.js';
import { UIController } from '../features/ui-controller.js';

export class App {
  constructor() {
    // Managers
    this.chat = new ChatManager();
    this.commands = new CommandsManager();
    this.model = new ModelManager();

    // Feature modules
    this.webSearch = new WebSearchManager();
    this.modelLoader = new ModelLoader(this.model);
    this.chatController = new ChatController(this.chat, this.model, this.webSearch);
    this.ui = new UIController(this);

    // Bind elements
    this.ui.bindElements();
  }

  async init() {
    // Initialize modules
    this.chat.init();
    this.commands.init();

    // Bind UI events
    this.ui.bindEvents();

    // Update web search UI
    this.webSearch.updateUI();

    // Check model status
    await this.initializeModel();
  }

  async initializeModel() {
    const selectedRuntime = localStorage.getItem('selectedRuntime') || 'onnx-webgpu';
    const runtimeJustChanged = sessionStorage.getItem('runtimeJustChanged') === 'true';

    const result = await this.modelLoader.initialize(selectedRuntime, runtimeJustChanged);

    if (result.success) {
      this.ui.showChat();
    } else if (result.waitingForSelection) {
      // Waiting for user to select Ollama model - listen for the event
      window.addEventListener('ollamaModelLoaded', (e) => {
        console.log('Ollama model loaded:', e.detail.model);
        this.ui.showChat();
      }, { once: true });
    } else if (result.downloading) {
      // Auto-download in progress - page will reload when complete
      console.log('Model downloading, waiting for completion...');
    }

    // Listen for CDN fallback
    window.addEventListener('modelLoadedFromCDN', () => {
      console.log('Model loaded from CDN');
      this.ui.showChat();
    }, { once: true });
  }

  // Delegated methods
  toggleWebSearch() {
    return this.webSearch.toggle();
  }

  async sendMessage(userText = null) {
    return this.chatController.sendMessage(userText);
  }

  stopGeneration() {
    return this.chatController.stopGeneration();
  }

  async regenerateFromEdit(userText) {
    return this.chatController.regenerateFromEdit(userText);
  }

  hasActiveConversation() {
    return this.chatController.hasActiveConversation();
  }

  // Legacy compatibility
  get isGenerating() {
    return this.chatController.isGenerating;
  }

  get abortController() {
    return this.chatController.abortController;
  }

  get webSearchEnabled() {
    return this.webSearch.webSearchEnabled;
  }

  // Ollama model selector
  showOllamaSelector() {
    return this.modelLoader.initializeOllama();
  }
}

// Initialize when DOM is ready
export async function initApp() {
  // Check WebGPU support
  let webGPUAvailable = false;

  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        webGPUAvailable = true;
      }
    } catch (err) {
      console.log('WebGPU check failed:', err.message);
    }
  }

  // If no WebGPU, auto-switch to Ollama mode
  if (!webGPUAvailable) {
    console.log('WebGPU not available, switching to Ollama mode...');
    localStorage.setItem('selectedRuntime', 'custom-endpoint');
    sessionStorage.setItem('runtimeJustChanged', 'true');
  }

  const app = new App();
  app.init();
  return app;
}

function showWebGPUError(reason) {
  document.body.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #0d0d0d;
      color: #e4e4e4;
      font-family: 'Inter', sans-serif;
      text-align: center;
      padding: 40px;
    ">
      <h1 style="color: #ff7a6b; margin-bottom: 16px;">⚠️ WebGPU Not Available</h1>
      <p style="color: #a0a0a0; margin-bottom: 24px; max-width: 500px;">
        ${reason}
      </p>
      <div style="text-align: left; max-width: 400px; color: #a0a0a0; font-size: 14px; margin-bottom: 24px;">
        <p style="margin-bottom: 12px;"><strong>Try these solutions:</strong></p>
        <ol style="padding-left: 20px; line-height: 1.8;">
          <li>Use Chrome 113+ or Edge 113+</li>
          <li>Enable WebGPU flags:<br>
            <code style="background: #2a2a2a; padding: 2px 6px; border-radius: 4px;">chrome://flags/#enable-webgpu-developer-features</code>
          </li>
          <li>Check your GPU drivers are up to date</li>
          <li>Close other apps using GPU</li>
        </ol>
      </div>
      <div style="display: flex; gap: 12px;">
        <button onclick="location.reload()" style="
          background: #64ffa0;
          color: #0d0d0d;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
        ">Retry</button>
        <button id="try-cpu-btn" style="
          background: transparent;
          color: #a0a0a0;
          border: 1px solid #444;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
        ">Try CPU Mode</button>
      </div>
      <p id="cpu-error" style="color: #ff7a6b; font-size: 12px; margin-top: 16px; display: none;">
        Note: Gemma 4 E2B requires WebGPU and may not work on CPU.
      </p>
    </div>
  `;

  // Attach CPU mode button handler
  const cpuBtn = document.getElementById('try-cpu-btn');
  const cpuError = document.getElementById('cpu-error');
  if (cpuBtn) {
    cpuBtn.addEventListener('click', () => {
      localStorage.setItem('selectedRuntime', 'onnx-cpu');
      cpuError.style.display = 'block';
      cpuBtn.textContent = 'Switching...';
      setTimeout(() => location.reload(), 500);
    });
  }
}
