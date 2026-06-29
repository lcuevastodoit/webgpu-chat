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
    }
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
}

// Initialize when DOM is ready
export function initApp() {
  // Check WebGPU support
  if (!navigator.gpu) {
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #0d0d0d;
        color: #e4e4e4;
        font-family: sans-serif;
        text-align: center;
        padding: 40px;
      ">
        <h1 style="color: #ff7a6b;">WebGPU Not Supported</h1>
        <p>Please use Chrome 113+ or Edge 113+</p>
      </div>
    `;
    return null;
  }

  const app = new App();
  app.init();
  return app;
}
