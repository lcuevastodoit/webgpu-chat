/**
 * Feature: UI Controller
 * Maneja la visualización de elementos y binding de eventos
 */

export class UIController {
  constructor(app) {
    this.app = app;
  }

  bindElements() {
    // Chat elements
    this.app.chat.bindElements({
      container: document.getElementById('chat-container'),
      messages: document.getElementById('chat-messages'),
      input: document.getElementById('input'),
      sendBtn: document.getElementById('send-btn'),
      emptyState: document.getElementById('empty-state'),
      inputContainer: document.getElementById('input-container'),
      sidebar: document.getElementById('sidebar'),
      overlay: document.getElementById('overlay'),
      history: document.getElementById('chat-history')
    });

    // Commands elements
    this.app.commands.bindElements({
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
    this.app.model.bindElements({
      statusDot: document.getElementById('status-dot'),
      statusText: document.getElementById('status-text')
    });

    // Make available globally
    window.chatManager = this.app.chat;
    window.commandsManager = this.app.commands;
    window.app = this.app;
  }

  bindEvents() {
    // New chat button
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.app.chat.startNewChat());
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
          const dropdown = document.getElementById('commands-dropdown');
          if (!dropdown?.classList.contains('show')) {
            this.app.sendMessage();
          }
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.app.sendMessage());
    }

    // Load buttons
    const downloadBtn = document.getElementById('download-model-btn');
    const loadCdnBtn = document.getElementById('load-cdn-btn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.app.modelLoader.downloadModel());
    }

    if (loadCdnBtn) {
      loadCdnBtn.addEventListener('click', () => this.app.modelLoader.downloadFromCDN());
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
    if (!this.app.chat.currentChatId) {
      this.app.chat.startNewChat();
    }
  }
}
