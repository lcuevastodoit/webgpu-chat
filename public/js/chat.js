// Chat management

import { loadChats, saveChats } from './storage.js';
import { escapeHtml } from './utils.js';

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
  }

  bindElements(elements) {
    this.elements = elements;
  }

  init() {
    this.chats = loadChats();
    this.renderHistory();
    this.loadCurrentChat();
  }

  addMessage(content, role, messageId = null) {
    const { container } = this.elements;
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + role;
    if (messageId) messageDiv.dataset.messageId = messageId;

    const avatar = role === 'user' ? 'You' : 'AI';
    const avatarClass = role === 'user' ? 'user' : 'assistant';
    let html = role === 'assistant' ? marked.parse(content) : escapeHtml(content);

    // Add copy buttons to code blocks
    if (role === 'assistant') {
      html = this.addCodeCopyButtons(html);
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
    this.scrollToBottom();
    return messageDiv;
  }

  addCodeCopyButtons(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    div.querySelectorAll('pre code').forEach((codeBlock) => {
      const pre = codeBlock.closest('pre');
      const code = codeBlock.textContent;
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

  copyCode(btn) {
    const wrapper = btn.closest('.code-block-wrapper');
    const code = wrapper.querySelector('code')?.textContent || '';

    navigator.clipboard.writeText(code).then(() => {
      const original = btn.innerHTML;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      setTimeout(() => btn.innerHTML = original, 2000);
    });
  }

  editMessage(btn) {
    const messageDiv = btn.closest('.message');
    const messageBody = messageDiv.querySelector('.message-body');
    const messageText = messageBody.querySelector('.message-text');

    const msgIndex = Array.from(messageDiv.parentElement.children).indexOf(messageDiv);
    const message = this.messages[msgIndex];
    if (!message || message.role !== 'user') return;

    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = message.content;
    textarea.rows = Math.min(10, message.content.split('\n').length + 2);

    const actions = document.createElement('div');
    actions.className = 'edit-actions';
    actions.innerHTML = `
      <button class="edit-save">Save & Submit</button>
      <button class="edit-cancel">Cancel</button>
    `;

    messageText.style.display = 'none';
    btn.closest('.message-actions').style.display = 'none';
    messageBody.insertBefore(textarea, messageText);
    messageBody.appendChild(actions);
    textarea.focus();

    const save = () => {
      const newText = textarea.value.trim();
      if (newText && newText !== message.content) {
        // Check if this is the last user message and has an assistant response after it
        const hasAssistantResponse = this.messages[msgIndex + 1]?.role === 'assistant';

        // Remove messages from this point onwards (including assistant response if exists)
        this.messages = this.messages.slice(0, msgIndex);
        this.messages.push({ role: 'user', content: newText });

        // Remove assistant message div if it exists
        if (hasAssistantResponse && messageDiv.nextElementSibling) {
          messageDiv.nextElementSibling.remove();
        }

        this.saveCurrentChat();

        // Update UI
        textarea.remove();
        actions.remove();
        messageText.innerHTML = marked.parse(newText);
        messageText.style.display = '';
        btn.closest('.message-actions').style.display = '';

        // Trigger regeneration with new text
        if (window.app) {
          window.app.regenerateFromEdit(newText);
        }
      } else {
        cancel();
      }
    };

    const cancel = () => {
      textarea.remove();
      actions.remove();
      messageText.style.display = '';
      btn.closest('.message-actions').style.display = '';
    };

    actions.querySelector('.edit-save').addEventListener('click', save);
    actions.querySelector('.edit-cancel').addEventListener('click', cancel);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        cancel();
      }
    });
  }

  regenerateMessage(btn) {
    const messageDiv = btn.closest('.message');
    const msgIndex = Array.from(messageDiv.parentElement.children).indexOf(messageDiv);

    // Only allow regenerating assistant messages that have a user message before them
    const message = this.messages[msgIndex];
    if (!message || message.role !== 'assistant') return;

    // Find the user message that triggered this response
    let userMsgIndex = msgIndex - 1;
    while (userMsgIndex >= 0 && this.messages[userMsgIndex].role !== 'user') {
      userMsgIndex--;
    }

    if (userMsgIndex < 0) return;

    const userText = this.messages[userMsgIndex].content;

    // Remove this assistant message and any after it
    this.messages = this.messages.slice(0, msgIndex);
    this.saveCurrentChat();
    this.renderMessages();

    // Trigger regeneration with the user text
    if (window.app) {
      window.app.regenerateFromEdit(userText);
    }
  }

  regenerateLastResponse() {
    // Find the last assistant message
    let lastAssistantIndex = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex < 0) return;

    // Find the user message before it
    let userMsgIndex = lastAssistantIndex - 1;
    while (userMsgIndex >= 0 && this.messages[userMsgIndex].role !== 'user') {
      userMsgIndex--;
    }

    if (userMsgIndex < 0) return;

    const userText = this.messages[userMsgIndex].content;

    // Remove the last assistant message
    this.messages = this.messages.slice(0, lastAssistantIndex);
    this.saveCurrentChat();
    this.renderMessages();

    // Regenerate
    if (window.app) {
      window.app.regenerateFromEdit(userText);
    }
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

    this.messages.forEach((msg, index) => {
      this.addMessage(msg.content, msg.role, index);
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
        <div class="chat-item-content" onclick="window.chatManager.loadChat('${chat.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="chat-title">${escapeHtml(chat.title || 'New chat')}</span>
        </div>
        <button class="rename-btn" onclick="window.chatManager.startRename(event, '${chat.id}')" title="Rename chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>
    `).join('');
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

    // Replace span with input
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

    // Delay blur handler to allow click events to process
    setTimeout(() => {
      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (!saved) save();
        }, 100);
      });
    }, 0);
  }

  copyMessage(btn) {
    const messageBody = btn.closest('.message-body');
    if (!messageBody) return;

    // Get text from message-text div
    const messageText = messageBody.querySelector('.message-text');
    const text = messageText?.innerText || messageText?.textContent || '';

    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 2000);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }

  getMessages() {
    return this.messages;
  }

  addToMessages(message) {
    this.messages.push(message);
  }

  exportToMarkdown() {
    if (!this.messages || this.messages.length === 0) {
      alert('No messages to export');
      return;
    }

    const title = this.chats.find(c => c.id === this.currentChatId)?.title || 'Chat';
    const date = new Date().toLocaleString();

    let markdown = `# ${title}\n\n`;
    markdown += `*Exported on ${date}*\n\n`;
    markdown += `---\n\n`;

    this.messages.forEach(msg => {
      const role = msg.role === 'user' ? '**You**' : '**Gemma**';
      markdown += `## ${role}\n\n${msg.content}\n\n---\n\n`;
    });

    // Download file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async exportToPDF() {
    if (!this.messages || this.messages.length === 0) {
      alert('No messages to export');
      return;
    }

    // Check if html2pdf is available
    if (typeof html2pdf === 'undefined') {
      alert('PDF export library not loaded. Please try again.');
      return;
    }

    const title = this.chats.find(c => c.id === this.currentChatId)?.title || 'Chat';
    const date = new Date().toLocaleString();

    // Create temporary container for PDF content
    const container = document.createElement('div');
    container.className = 'pdf-export';
    container.style.cssText = `
      padding: 40px;
      background: white;
      color: #1a1a1a;
      font-family: 'Inter', -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
    `;

    // Build content
    let content = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #64ffa0; padding-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">${escapeHtml(title)}</h1>
        <p style="margin: 10px 0 0; color: #6b7280; font-size: 12px;">Exported on ${date}</p>
      </div>
    `;

    this.messages.forEach(msg => {
      const isUser = msg.role === 'user';
      const avatar = isUser ? 'You' : 'Gemma';
      const bgColor = isUser ? '#f7f7f8' : '#f0fdf4';
      const borderColor = isUser ? '#e5e5e5' : '#64ffa0';

      content += `
        <div style="margin-bottom: 20px; padding: 16px; background: ${bgColor}; border-radius: 8px; border-left: 3px solid ${borderColor};">
          <div style="font-weight: 600; margin-bottom: 8px; color: #1a1a1a; font-size: 14px;">${avatar}</div>
          <div style="line-height: 1.6; color: #1a1a1a; font-size: 14px;">${marked.parse(msg.content).replace(/style="[^"]*"/g, '')}</div>
        </div>
      `;
    });

    container.innerHTML = content;
    document.body.appendChild(container);

    // Generate PDF
    const opt = {
      margin: 10,
      filename: `chat-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(container).save();
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Error exporting PDF. Please try again.');
    } finally {
      document.body.removeChild(container);
    }
  }
}

window.ChatManager = ChatManager;
