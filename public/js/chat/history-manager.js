import { escapeHtml } from '../utils.js';
import { saveChats } from '../storage.js';

export class HistoryManager {
  constructor(elements, chatsState, currentChatIdState) {
    this.elements = elements;
    this.chats = chatsState;
    this.currentChatId = currentChatIdState;
  }

  renderHistory() {
    const { history } = this.elements;
    if (!history) return;

    const sortedChats = [...this.chats].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.created - a.created;
    });

    history.innerHTML = sortedChats.map(chat => `
      <div class="chat-item ${chat.id === this.currentChatId ? 'active' : ''} ${chat.pinned ? 'pinned' : ''}" data-id="${chat.id}">
        <div class="chat-item-content" onclick="window.chatManager.loadChat('${chat.id}')" title="${escapeHtml(chat.title || 'New chat')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          ${chat.pinned ? '<svg class="pin-icon" viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z"/></svg> ' : ''}
          <span class="chat-title">${escapeHtml(chat.title || 'New chat')}</span>
        </div>
        <div class="chat-actions">
          <button class="action-btn pin-btn ${chat.pinned ? 'active' : ''}" onclick="window.chatManager.togglePin(event, '${chat.id}')" title="${chat.pinned ? 'Unpin chat' : 'Pin chat'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          <button class="action-btn rename-btn" onclick="window.chatManager.startRename(event, '${chat.id}')" title="Rename chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="action-btn delete-btn" onclick="window.chatManager.deleteChat(event, '${chat.id}')" title="Delete chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  togglePin(event, chatId) {
    event.stopPropagation();
    const chat = this.chats.find(c => c.id === chatId);
    if (!chat) return;

    chat.pinned = !chat.pinned;
    saveChats(this.chats);
    this.renderHistory();
  }

  deleteChat(event, chatId, callbacks) {
    event.stopPropagation();

    if (!confirm('Delete this conversation?')) return;

    const wasCurrentChat = this.currentChatId === chatId;
    this.chats = this.chats.filter(c => c.id !== chatId);
    saveChats(this.chats);

    if (wasCurrentChat && callbacks) {
      callbacks.onClearCurrentChat();
    }

    this.renderHistory();
    return { wasCurrentChat };
  }

  startRename(event, chatId) {
    event.stopPropagation();
    const chat = this.chats.find(c => c.id === chatId);
    if (!chat) return;

    const chatItem = event.currentTarget.closest('.chat-item');
    const titleSpan = chatItem.querySelector('.chat-title');
    if (!titleSpan) return;

    const currentTitle = chat.title || 'New chat';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'rename-input';

    titleSpan.replaceWith(input);
    input.focus();
    input.select();

    let saved = false;

    const save = () => {
      if (saved) return;
      saved = true;
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentTitle) {
        chat.title = newTitle;
        saveChats(this.chats);
      }
      this.renderHistory();
    };

    const cancel = () => {
      if (saved) return;
      saved = true;
      this.renderHistory();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    setTimeout(() => {
      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (!saved) save();
        }, 100);
      });
    }, 0);
  }
}
