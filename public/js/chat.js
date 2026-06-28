// Chat management

import { loadChats, saveChats } from './storage.js';
import { escapeHtml } from './utils.js';

export class ChatManager {
  constructor() {
    this.messages = [];
    this.currentChatId = null;
    this.chats = [];
    this.elements = {};
  }

  bindElements(elements) {
    this.elements = elements;
  }

  init() {
    this.chats = loadChats();
    this.renderHistory();
    this.loadCurrentChat();
  }

  addMessage(content, role) {
    const { container } = this.elements;
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + role;

    const avatar = role === 'user' ? 'You' : 'AI';
    const avatarClass = role === 'user' ? 'user' : 'assistant';
    const html = role === 'assistant' ? marked.parse(content) : escapeHtml(content);

    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="avatar ${avatarClass}">${avatar}</div>
        <div class="message-body">
          ${html}
          ${role === 'assistant' ? `
            <div class="message-actions">
              <button class="action-btn" onclick="window.chatManager.copyMessage(this)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    container.appendChild(messageDiv);
    this.scrollToBottom();
    return messageDiv;
  }

  addTypingIndicator() {
    const { container } = this.elements;
    if (!container) return null;

    const id = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = id;
    typingDiv.className = 'message assistant';
    typingDiv.innerHTML = `
      <div class="message-content">
        <div class="avatar assistant">AI</div>
        <div class="message-body">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(typingDiv);
    this.scrollToBottom();
    return id;
  }

  updateTypingIndicator(id, text) {
    const typingDiv = document.getElementById(id);
    if (!typingDiv) return;

    const body = typingDiv.querySelector('.message-body');
    if (body) {
      body.innerHTML = marked.parse(text) + `
        <div class="message-actions">
          <button class="action-btn" onclick="window.chatManager.copyMessage(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
      `;
      this.scrollToBottom();
    }
  }

  removeTypingIndicator(id) {
    const typingDiv = document.getElementById(id);
    if (typingDiv) {
      typingDiv.remove();
    }
  }

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

    if (emptyState) emptyState.style.display = 'none';
    if (inputContainer) inputContainer.style.display = 'block';
    if (input) input.focus();
  }

  loadCurrentChat() {
    if (this.chats.length > 0 && !this.currentChatId) {
      this.currentChatId = this.chats[0].id;
      this.messages = this.chats[0].messages || [];
      this.renderMessages();
    }
  }

  renderMessages() {
    const { container, emptyState, inputContainer } = this.elements;
    if (!container) return;

    container.innerHTML = '';
    if (this.messages.length === 0) return;

    if (emptyState) emptyState.style.display = 'none';
    if (inputContainer) inputContainer.style.display = 'block';

    this.messages.forEach(msg => {
      this.addMessage(msg.content, msg.role);
    });
  }

  loadChat(id) {
    const { sidebar, overlay } = this.elements;

    this.currentChatId = id;
    const chat = this.chats.find(c => c.id === id);
    if (chat) {
      this.messages = chat.messages || [];
      this.renderMessages();
      this.renderHistory();
    }

    // Close mobile sidebar
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

  renderHistory() {
    const { history } = this.elements;
    if (!history) return;

    history.innerHTML = this.chats.map(chat => `
      <div class="chat-item ${chat.id === this.currentChatId ? 'active' : ''}" data-id="${chat.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        ${escapeHtml(chat.title || 'New chat')}
      </div>
    `).join('');

    // Add click handlers
    history.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', () => {
        this.loadChat(item.dataset.id);
      });
    });
  }

  copyMessage(btn) {
    const messageBody = btn.closest('.message-body');
    if (!messageBody) return;

    const text = messageBody.childNodes[0]?.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        `;
      }, 2000);
    });
  }

  getMessages() {
    return this.messages;
  }

  addToMessages(message) {
    this.messages.push(message);
  }
}

window.ChatManager = ChatManager;
