// Main application entry point

import { ChatManager } from './chat.js';
import { CommandsManager } from './commands.js';
import { ModelManager } from './model.js';
import { formatBytes } from './utils.js';

class App {
  constructor() {
    this.chat = new ChatManager();
    this.commands = new CommandsManager();
    this.model = new ModelManager();
    this.isGenerating = false;
    this.abortController = null;

    this.bindElements();
  }

  bindElements() {
    // Chat elements
    this.chat.bindElements({
      container: document.getElementById('chat-container'),
      history: document.getElementById('chat-history'),
      emptyState: document.getElementById('empty-state'),
      inputContainer: document.getElementById('input-container'),
      sidebar: document.getElementById('sidebar'),
      overlay: document.getElementById('overlay')
    });

    // Commands elements
    this.commands.bindElements({
      btn: document.getElementById('commands-btn'),
      modal: document.getElementById('commands-modal'),
      close: document.getElementById('modal-close'),
      save: document.getElementById('btn-save'),
      manage: document.getElementById('btn-manage'),
      remove: document.getElementById('remove-cmd'),
      dropdown: document.getElementById('commands-dropdown'),
      input: document.getElementById('input'),
      badge: document.getElementById('command-badge'),
      badgeIcon: document.getElementById('command-badge-icon'),
      badgeText: document.getElementById('command-badge-text'),
      name: document.getElementById('cmd-name'),
      desc: document.getElementById('cmd-desc'),
      prompt: document.getElementById('cmd-prompt'),
      icon: document.getElementById('cmd-icon'),
      form: document.getElementById('command-form'),
      list: document.getElementById('saved-commands-list')
    });

    // Model elements
    this.model.bindElements({
      statusDot: document.getElementById('status-dot'),
      statusText: document.getElementById('status-text')
    });

    // Make available globally for inline handlers
    window.chatManager = this.chat;
    window.commandsManager = this.commands;
    window.app = this;
  }

  async init() {
    // Initialize modules
    this.chat.init();
    this.commands.init();

    // Bind UI events
    this.bindEvents();

    // Check model status
    await this.initializeModel();
  }

  bindEvents() {
    // New chat button
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.chat.startNewChat());
    }

    // Mobile menu
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (menuBtn && sidebar && overlay) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
      });

      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }

    // Input events
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          // Don't send if commands dropdown is visible
          const dropdown = document.getElementById('commands-dropdown');
          if (!dropdown?.classList.contains('show')) {
            this.sendMessage();
          }
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Load buttons
    const downloadBtn = document.getElementById('download-model-btn');
    const loadCdnBtn = document.getElementById('load-cdn-btn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadModel());
    }

    if (loadCdnBtn) {
      loadCdnBtn.addEventListener('click', () => this.loadFromCDN());
    }
  }

  async initializeModel() {
    const checkingState = document.getElementById('checking-state');
    const loadingLocalState = document.getElementById('loading-local-state');
    const cdnLoadState = document.getElementById('cdn-load-state');
    const emptySubtitle = document.getElementById('empty-subtitle');

    // Show checking state
    if (emptySubtitle) emptySubtitle.classList.add('hidden');
    if (checkingState) checkingState.classList.remove('hidden');

    try {
      const status = await this.model.checkLocalStatus();

      if (checkingState) checkingState.classList.add('hidden');

      if (status.exists) {
        // Load from local
        if (loadingLocalState) loadingLocalState.classList.remove('hidden');

        await this.model.loadFromLocal((event) => {
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
        });

        this.showChat();
      } else {
        // Show CDN load option
        if (emptySubtitle) emptySubtitle.classList.remove('hidden');
        if (cdnLoadState) cdnLoadState.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Initialization error:', err);
      if (checkingState) checkingState.classList.add('hidden');
      if (emptySubtitle) emptySubtitle.classList.remove('hidden');
      if (cdnLoadState) cdnLoadState.classList.remove('hidden');
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
      alert(result.message + ' Refresh when complete.');
    } catch (err) {
      alert('Error starting download: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = 'Download Model (~2.3GB)';
    }
  }

  async loadFromCDN() {
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
          const loaded = event.loaded || 0;
          const total = event.total || 0;
          if (text) {
            text.textContent = `Loading: ${formatBytes(loaded)} / ${formatBytes(total)} (${Math.round(event.fraction * 100)}%)`;
          }
          if (fill) fill.style.width = (4 + event.fraction * 96) + '%';
        }
      });

      this.showChat();
    } catch (err) {
      console.error('CDN load error:', err);
      if (cdnLoadState) cdnLoadState.classList.remove('hidden');
    }
  }

  showChat() {
    const emptyState = document.getElementById('empty-state');
    const inputContainer = document.getElementById('input-container');
    const loadingLocalState = document.getElementById('loading-local-state');
    const progressBar = document.getElementById('progress-bar');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    if (emptyState) emptyState.style.display = 'none';
    if (loadingLocalState) loadingLocalState.classList.add('hidden');
    if (progressBar) progressBar.style.display = 'none';
    if (inputContainer) inputContainer.style.display = 'block';
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (sendBtn) sendBtn.disabled = false;

    // Create first chat if needed
    if (!this.chat.currentChatId) {
      this.chat.startNewChat();
    }
  }

  async sendMessage(userText = null) {
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    if (!this.model.isReady || this.isGenerating) return;

    const text = userText || input?.value?.trim();
    if (!text) return;

    // Clear input if not regenerating
    if (!userText && input) {
      input.value = '';
      input.style.height = 'auto';
    }

    this.isGenerating = true;
    this.abortController = new AbortController();

    if (input) input.disabled = true;
    if (sendBtn) {
      sendBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12" rx="2"></rect>
        </svg>
      `;
      sendBtn.title = 'Stop generation';
      sendBtn.onclick = () => this.stopGeneration();
      sendBtn.disabled = false;
    }

    // Prepare messages
    let chatMessages = [...this.chat.getMessages()];

    // Add system prompt if active command
    const activeCmd = this.commands.getActive();
    if (activeCmd) {
      if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
        chatMessages.unshift({
          role: 'system',
          content: activeCmd.systemPrompt
        });
      }
    }

    // Add user message (only if not regenerating)
    if (!userText) {
      this.chat.addMessage(text, 'user');
      this.chat.addToMessages({ role: 'user', content: text });
    }
    chatMessages.push({ role: 'user', content: text });

    // Add typing indicator
    const typingId = this.chat.addTypingIndicator();
    let reply = '';

    try {
      console.log('Starting generation with messages:', chatMessages);

      const stream = this.model.generate(chatMessages, { maxNewTokens: 4096 });

      for await (const { text: full } of stream) {
        reply = full;
        this.chat.updateTypingIndicator(typingId, reply);
      }

      this.chat.removeTypingIndicator(typingId);
      if (reply) {
        this.chat.addMessage(reply, 'assistant');
        this.chat.addToMessages({ role: 'assistant', content: reply });
      }

      this.chat.saveCurrentChat();
    } catch (err) {
      console.error('Generation error:', err);
      this.chat.removeTypingIndicator(typingId);
      this.chat.addMessage('Error: ' + err.message, 'error');
    }

    this.isGenerating = false;
    this.abortController = null;

    if (input) input.disabled = false;
    if (sendBtn) {
      sendBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      `;
      sendBtn.title = 'Send message';
      sendBtn.onclick = () => this.sendMessage();
      sendBtn.disabled = false;
    }
    if (input) input.focus();
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async regenerateFromEdit(userText) {
    // This is called when editing the last user message or regenerating
    // userText is the (possibly edited) text to send
    await this.sendMessage(userText);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
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
    return;
  }

  const app = new App();
  app.init();
});
