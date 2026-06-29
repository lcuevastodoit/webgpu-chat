import { escapeHtml } from '../utils.js';

export class ExportManager {
  constructor(messages, chats, currentChatId) {
    this.messages = messages;
    this.chats = chats;
    this.currentChatId = currentChatId;
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

    if (typeof html2pdf === 'undefined') {
      alert('PDF export library not loaded. Please try again.');
      return;
    }

    const title = this.chats.find(c => c.id === this.currentChatId)?.title || 'Chat';
    const date = new Date().toLocaleString();

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
