import { escapeHtml } from '../utils.js';

export class MessageRenderer {
  constructor(elements, scrollCallback) {
    this.elements = elements;
    this.scrollCallback = scrollCallback;
  }

  addWebSearchResult(content) {
    const { container } = this.elements;
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message web-search';

    const isError = content.includes('CAPTCHA') || content.includes('blocked') || content.includes('error') || content.length < 200;
    const previewText = content.slice(0, 200) + (content.length > 200 ? '...' : '');

    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="avatar system" style="${isError ? 'background: rgba(255, 122, 107, 0.2); color: #ff7a6b;' : ''}">${isError ? '⚠️' : '🌐'}</div>
        <div class="message-body">
          <div class="web-search-header" onclick="this.closest('.web-search').classList.toggle('expanded')">
            <span class="web-search-title" style="${isError ? 'color: #ff7a6b;' : ''}">${isError ? '⚠️ Search limited' : '📄 Web search results'}</span>
            <svg class="web-search-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="web-search-preview" style="${isError ? 'color: #ff7a6b;' : ''}">${escapeHtml(previewText)}</div>
          <div class="web-search-content hidden">
            <div class="web-search-text">${escapeHtml(content)}</div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(messageDiv);
    this.scrollCallback();
    return messageDiv;
  }

  addMessage(content, role, messageId = null, codeCopyCallback) {
    const { container } = this.elements;
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + role;
    if (messageId !== null) messageDiv.dataset.messageId = messageId;

    const avatar = role === 'user' ? 'You' : 'AI';
    const avatarClass = role === 'user' ? 'user' : 'assistant';
    let html = role === 'assistant' ? marked.parse(content) : escapeHtml(content);

    if (role === 'assistant' && codeCopyCallback) {
      html = codeCopyCallback(html);
    }

    const actions = role === 'assistant' ? `
      <div class="message-actions">
        <button class="action-btn" onclick="window.chatManager.copyMessage(this)" title="Copy message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        <button class="action-btn" onclick="window.chatManager.regenerateMessage(this)" title="Regenerate response">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Regenerate
        </button>
      </div>
    ` : `
      <div class="message-actions">
        <button class="action-btn edit-btn" onclick="window.chatManager.editMessage(this)" title="Edit message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        </button>
      </div>
    `;

    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="avatar ${avatarClass}">${avatar}</div>
        <div class="message-body">
          <div class="message-text">${html}</div>
          ${actions}
        </div>
      </div>
    `;

    container.appendChild(messageDiv);

    if (role === 'assistant' && typeof hljs !== 'undefined') {
      messageDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }

    this.scrollCallback();
    return messageDiv;
  }

  addCodeCopyButtons(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    div.querySelectorAll('pre code').forEach((codeBlock) => {
      const pre = codeBlock.closest('pre');
      const lang = codeBlock.className.match(/language-(\w+)/)?.[1] || 'code';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.innerHTML = `
        <span class="code-lang">${lang}</span>
        <button class="code-copy-btn" onclick="window.chatManager.copyCode(this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy code
        </button>
      `;

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });

    return div.innerHTML;
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
    this.scrollCallback();
    return id;
  }

  updateTypingIndicator(id, text) {
    const typingDiv = document.getElementById(id);
    if (!typingDiv) return;

    const body = typingDiv.querySelector('.message-body');
    if (body) {
      body.innerHTML = `
        <div class="message-text">${marked.parse(text)}</div>
        <div class="message-actions">
          <button class="action-btn" onclick="window.chatManager.copyMessage(this)" title="Copy message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
          <button class="action-btn" onclick="window.chatManager.regenerateMessage(this)" title="Regenerate response">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Regenerate
          </button>
        </div>
      `;

      if (typeof hljs !== 'undefined') {
        body.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
      }

      this.scrollCallback();
    }
  }

  removeTypingIndicator(id) {
    const typingDiv = document.getElementById(id);
    if (typingDiv) {
      typingDiv.remove();
    }
  }
}
