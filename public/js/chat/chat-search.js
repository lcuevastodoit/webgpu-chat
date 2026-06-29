import { escapeHtml } from '../utils.js';

export class ChatSearch {
  constructor(elements, chats) {
    this.elements = elements;
    this.chats = chats;
  }

  toggleSearch() {
    const panel = document.getElementById('search-panel');
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      input?.focus();
      input.value = '';
      results.innerHTML = `
        <div class="search-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <p>Type to search through your saved conversations</p>
        </div>
      `;
    } else {
      panel.classList.add('hidden');
    }
  }

  searchInChats(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!query.trim()) {
      resultsContainer.innerHTML = `
        <div class="search-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <p>Type to search through your saved conversations</p>
        </div>
      `;
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const results = [];

    this.chats.forEach(chat => {
      const matchingMessages = [];

      if (chat.messages) {
        chat.messages.forEach((msg, index) => {
          if (msg.content && msg.content.toLowerCase().includes(normalizedQuery)) {
            const contextStart = Math.max(0, index - 1);
            const contextEnd = Math.min(chat.messages.length, index + 2);
            const context = chat.messages.slice(contextStart, contextEnd);

            matchingMessages.push({
              index,
              role: msg.role,
              content: msg.content,
              snippet: msg.content.slice(0, 150) + (msg.content.length > 150 ? '...' : ''),
              context
            });
          }
        });
      }

      if (matchingMessages.length > 0) {
        results.push({
          chat,
          matches: matchingMessages
        });
      }
    });

    this.renderLocalSearchResults(results, query);
  }

  renderLocalSearchResults(results, query) {
    const container = document.getElementById('search-results');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = `
        <div class="search-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
            <path d="M9.172 16.172a4 4 0 0 1-5.66 0M4 6h16M4 12h16M4 18h16"></path>
          </svg>
          <p>No conversations found matching "${escapeHtml(query)}"</p>
        </div>
      `;
      return;
    }

    let totalMatches = 0;
    container.innerHTML = results.map(result => {
      totalMatches += result.matches.length;
      return `
        <div class="search-result-chat">
          <div class="search-chat-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="search-chat-title">${escapeHtml(result.chat.title || 'New chat')}</span>
            <span class="search-match-count">${result.matches.length} match${result.matches.length > 1 ? 'es' : ''}</span>
          </div>
          ${result.matches.map((match) => `
            <div class="search-match-item" onclick="window.chatManager.openSearchResult('${result.chat.id}', ${match.index})">
              <div class="search-match-role ${match.role}">${match.role === 'user' ? 'You' : 'AI'}</div>
              <div class="search-match-text">${this.highlightText(escapeHtml(match.snippet), escapeHtml(query))}</div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');

    const header = document.createElement('div');
    header.className = 'search-total';
    header.innerHTML = `Found ${totalMatches} match${totalMatches > 1 ? 'es' : ''} in ${results.length} conversation${results.length > 1 ? 's' : ''}`;
    container.insertBefore(header, container.firstChild);
  }

  highlightText(text, query) {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  openSearchResult(chatId, messageIndex, callbacks) {
    this.toggleSearch();

    if (callbacks?.onLoadChat) {
      callbacks.onLoadChat(chatId);
    }

    setTimeout(() => {
      const container = this.elements.container;
      if (container) {
        const messages = container.querySelectorAll('.message');
        if (messages[messageIndex]) {
          messages[messageIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
          messages[messageIndex].style.background = 'rgba(100, 255, 160, 0.1)';
          setTimeout(() => {
            messages[messageIndex].style.background = '';
          }, 2000);
        }
      }
    }, 100);
  }

  initSearch(searchCallback) {
    const input = document.getElementById('search-input');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchCallback(e.target.value);
      }, 300);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.toggleSearch();
      }
    });
  }
}
