import { escapeHtml } from '../utils.js';
import { saveChats } from '../storage.js';

export class MessageActions {
  constructor(messages, saveCallback) {
    this.messages = messages;
    this.saveCallback = saveCallback;
  }

  copyMessage(btn) {
    const messageBody = btn.closest('.message-body');
    if (!messageBody) return;

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

  editMessage(btn, callbacks) {
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
        const hasAssistantResponse = this.messages[msgIndex + 1]?.role === 'assistant';

        this.messages.splice(msgIndex);
        this.messages.push({ role: 'user', content: newText });

        if (hasAssistantResponse && messageDiv.nextElementSibling) {
          messageDiv.nextElementSibling.remove();
        }

        this.saveCallback();

        textarea.remove();
        actions.remove();
        messageText.innerHTML = marked.parse(newText);
        messageText.style.display = '';
        btn.closest('.message-actions').style.display = '';

        if (callbacks?.onRegenerate) {
          callbacks.onRegenerate(newText);
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

  regenerateMessage(btn, callbacks) {
    const messageDiv = btn.closest('.message');
    const msgId = messageDiv.dataset.messageId;
    if (msgId === undefined) return;

    const msgIndex = parseInt(msgId, 10);
    const message = this.messages[msgIndex];
    if (!message || message.role !== 'assistant') return;

    let userMsgIndex = msgIndex - 1;
    while (userMsgIndex >= 0 && this.messages[userMsgIndex].role !== 'user') {
      userMsgIndex--;
    }

    if (userMsgIndex < 0) return;

    const userText = this.messages[userMsgIndex].content;

    this.messages = this.messages.slice(0, msgIndex);
    this.saveCallback();

    if (callbacks?.onRender) {
      callbacks.onRender();
    }

    if (callbacks?.onRegenerate) {
      callbacks.onRegenerate(userText);
    }
  }

  regenerateLastResponse(callbacks) {
    let lastAssistantIndex = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex < 0) return;

    let userMsgIndex = lastAssistantIndex - 1;
    while (userMsgIndex >= 0 && this.messages[userMsgIndex].role !== 'user') {
      userMsgIndex--;
    }

    if (userMsgIndex < 0) return;

    const userText = this.messages[userMsgIndex].content;

    this.messages = this.messages.slice(0, lastAssistantIndex);
    this.saveCallback();

    if (callbacks?.onRender) {
      callbacks.onRender();
    }

    if (callbacks?.onRegenerate) {
      callbacks.onRegenerate(userText);
    }
  }
}
