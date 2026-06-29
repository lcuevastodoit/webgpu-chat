import { loadChats, saveChats } from '../storage.js';
import { MessageRenderer } from './message-renderer.js';
import { HistoryManager } from './history-manager.js';
import { ChatSearch } from './chat-search.js';
import { MessageActions } from './message-actions.js';
import { ExportManager } from './export-manager.js';
import { TokenCounter } from './token-counter.js';

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  langPrefix: 'hljs language-'
});

export class ChatManager {
  constructor() {
    this.messages = [];
    this.currentChatId = null;
    this.chats = [];
    this.elements = {};

    // Initialize sub-modules
    this.messageRenderer = null;
    this.historyManager = null;
    this.chatSearch = null;
    this.messageActions = null;
    this.exportManager = null;
    this.tokenCounter = null;
  }

  bindElements(elements) {
    this.elements = elements;
    this.initModules();
  }

  initModules() {
    this.messageRenderer = new MessageRenderer(
      this.elements,
      () => this.scrollToBottom()
    );

    this.historyManager = new HistoryManager(
      this.elements,
      this.chats,
      this.currentChatId
    );

    this.chatSearch = new ChatSearch(
      this.elements,
      this.chats
    );

    this.messageActions = new MessageActions(
      this.messages,
      () => this.saveCurrentChat()
    );

    this.exportManager = new ExportManager(
      this.messages,
      this.chats,
      this.currentChatId
    );

    this.tokenCounter = new TokenCounter();
  }

  init() {
    this.chats = loadChats();
    this.renderHistory();
    this.loadCurrentChat();
    this.initSearch();
  }

  // Message Rendering delegation
  addWebSearchResult(content) {
    return this.messageRenderer.addWebSearchResult(content);
  }

  addMessage(content, role, messageId = null) {
    // Support both (content, role) and (role, content) signatures for compatibility
    let actualContent = content;
    let actualRole = role;

    // Detect if first arg is role (assistant/user) and second is content
    if ((content === 'user' || content === 'assistant') && typeof role === 'string') {
      actualRole = content;
      actualContent = role;
    }

    return this.messageRenderer.addMessage(
      actualContent,
      actualRole,
      messageId,
      (html) => this.messageRenderer.addCodeCopyButtons(html)
    );
  }

  updateMessage(messageElement, text) {
    // Update the message content in the DOM
    const messageText = messageElement.querySelector('.message-text');
    if (messageText) {
      messageText.innerHTML = marked.parse(text);
      // Re-apply syntax highlighting
      if (typeof hljs !== 'undefined') {
        messageText.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
      }
    }
  }

  showWebSearchResults(messageId, results) {
    // Add web search results as a system message
    this.addWebSearchResult(results);
  }

  showError(message) {
    // Display error message in the chat
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error';
    errorDiv.innerHTML = `
      <div class="message-content">
        <div class="avatar system" style="background: rgba(255, 122, 107, 0.2); color: #ff7a6b;">⚠️</div>
        <div class="message-body">
          <div class="message-text">${message}</div>
        </div>
      </div>
    `;
    const { container } = this.elements;
    if (container) {
      container.appendChild(errorDiv);
      this.scrollToBottom();
    }
  }

  addTypingIndicator() {
    return this.messageRenderer.addTypingIndicator();
  }

  updateTypingIndicator(id, text) {
    this.messageRenderer.updateTypingIndicator(id, text);
  }

  removeTypingIndicator(id) {
    this.messageRenderer.removeTypingIndicator(id);
  }

  addCodeCopyButtons(html) {
    return this.messageRenderer.addCodeCopyButtons(html);
  }

  // History Management delegation
  renderHistory() {
    // Update references in history manager
    this.historyManager.chats = this.chats;
    this.historyManager.currentChatId = this.currentChatId;
    this.historyManager.renderHistory();
  }

  togglePin(event, chatId) {
    this.historyManager.togglePin(event, chatId);
  }

  deleteChat(event, chatId) {
    const result = this.historyManager.deleteChat(event, chatId, {
      onClearCurrentChat: () => {
        this.currentChatId = null;
        this.messages = [];
        if (this.elements.container) {
          this.elements.container.innerHTML = '';
        }
        if (this.elements.emptyState) {
          this.elements.emptyState.style.display = 'flex';
        }
        if (this.elements.inputContainer) {
          this.elements.inputContainer.style.display = 'none';
        }
        this.clearTokenCounter();
      }
    });

    if (result?.wasCurrentChat) {
      this.currentChatId = null;
      this.messages = [];
    }
  }

  startRename(event, chatId) {
    this.historyManager.startRename(event, chatId);
  }

  // Search delegation
  toggleSearch() {
    this.chatSearch.toggleSearch();
  }

  searchInChats(query) {
    this.chatSearch.searchInChats(query);
  }

  renderLocalSearchResults(results, query) {
    this.chatSearch.renderLocalSearchResults(results, query);
  }

  highlightText(text, query) {
    return this.chatSearch.highlightText(text, query);
  }

  openSearchResult(chatId, messageIndex) {
    this.chatSearch.openSearchResult(chatId, messageIndex, {
      onLoadChat: (id) => this.loadChat(id)
    });
  }

  initSearch() {
    this.chatSearch.initSearch((query) => this.searchInChats(query));
  }

  // Message Actions delegation
  copyMessage(btn) {
    this.messageActions.copyMessage(btn);
  }

  copyCode(btn) {
    this.messageActions.copyCode(btn);
  }

  editMessage(btn) {
    this.messageActions.editMessage(btn, {
      onRegenerate: (text) => {
        if (window.app) {
          window.app.regenerateFromEdit(text);
        }
      }
    });
  }

  regenerateMessage(btn) {
    this.messageActions.regenerateMessage(btn, {
      onRender: () => this.renderMessages(),
      onRegenerate: (text) => {
        if (window.app) {
          window.app.regenerateFromEdit(text);
        }
      }
    });
  }

  regenerateLastResponse() {
    this.messageActions.regenerateLastResponse({
      onRender: () => this.renderMessages(),
      onRegenerate: (text) => {
        if (window.app) {
          window.app.regenerateFromEdit(text);
        }
      }
    });
  }

  // Export delegation
  exportToMarkdown() {
    this.exportManager.messages = this.messages;
    this.exportManager.currentChatId = this.currentChatId;
    this.exportManager.exportToMarkdown();
  }

  exportToPDF() {
    this.exportManager.messages = this.messages;
    this.exportManager.currentChatId = this.currentChatId;
    this.exportManager.exportToPDF();
  }

  // Token Counter delegation
  updateTokenCounter() {
    this.tokenCounter.updateTokenCounter(this.messages);
  }

  clearTokenCounter() {
    this.tokenCounter.clearTokenCounter();
  }

  // Core functionality
  scrollToBottom() {
    const { container } = this.elements;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  startNewChat() {
    const { container, emptyState, inputContainer, input } = this.elements;

    this.currentChatId = Date.now().toString();
    this.messages = [];

    if (container) container.innerHTML = '';

    const chat = {
      id: this.currentChatId,
      title: 'New chat',
      messages: [],
      created: Date.now()
    };

    this.chats.unshift(chat);
    saveChats(this.chats);
    this.renderHistory();
    this.clearTokenCounter();

    if (emptyState) emptyState.style.display = 'none';
    if (inputContainer) inputContainer.style.display = 'block';
    if (input) input.focus();
  }

  loadCurrentChat() {
    if (this.chats.length > 0 && !this.currentChatId) {
      this.currentChatId = this.chats[0].id;
      this.messages = this.chats[0].messages || [];
      this.renderMessages();
      this.updateTokenCounter();
    }
  }

  renderMessages() {
    const { container, emptyState, inputContainer } = this.elements;
    if (!container) return;

    container.innerHTML = '';
    if (this.messages.length === 0) {
      this.clearTokenCounter();
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (inputContainer) inputContainer.style.display = 'block';

    this.messages.forEach((msg, index) => {
      this.addMessage(msg.content, msg.role, index);
    });

    if (typeof hljs !== 'undefined') {
      container.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }

    this.updateTokenCounter();
  }

  loadChat(id) {
    const { sidebar, overlay } = this.elements;

    this.currentChatId = id;
    const chat = this.chats.find(c => c.id === id);
    if (chat) {
      this.messages = chat.messages || [];
      this.renderMessages();
      this.renderHistory();
      this.updateTokenCounter();
    }

    if (window.innerWidth < 768 && sidebar && overlay) {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    }
  }

  saveCurrentChat() {
    const chat = this.chats.find(c => c.id === this.currentChatId);
    if (chat) {
      chat.messages = this.messages;
      chat.title = this.messages[0]?.content.slice(0, 30) + '...' || 'New chat';
      saveChats(this.chats);
      this.renderHistory();
    }
  }

  addToMessages(message) {
    this.messages.push(message);
    this.updateTokenCounter();
  }

  getMessages() {
    return this.messages;
  }

  // Compatibility methods for chat-controller.js
  getConversationMessages() {
    return this.messages;
  }

  addToConversation(message) {
    this.messages.push(message);
    this.saveCurrentChat();
    this.updateTokenCounter();
  }

  removeLastAssistantMessage() {
    const { container } = this.elements;
    if (!container) return;

    const messages = container.querySelectorAll('.message');
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].classList.contains('assistant')) {
        messages[i].remove();
        break;
      }
    }
  }

  removeLastFromConversation() {
    // Remove the last message from the messages array
    if (this.messages.length > 0) {
      this.messages.pop();
      this.saveCurrentChat();
      this.updateTokenCounter();
    }
  }
}

window.ChatManager = ChatManager;
