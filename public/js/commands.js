// Commands system (slash commands)

import { loadCommands, saveCommands } from './storage.js';
import { escapeHtml } from './utils.js';

export const DEFAULT_COMMANDS = [
  {
    id: 'default-code',
    name: 'code',
    description: 'Expert developer mode',
    systemPrompt: 'You are an expert software developer. Provide clean, well-documented code with explanations. Use best practices and modern patterns.',
    icon: '💻'
  },
  {
    id: 'default-explain',
    name: 'explain',
    description: "Explain like I'm 5",
    systemPrompt: 'Explain complex topics in simple terms. Use analogies and examples. Avoid jargon unless explained.',
    icon: '📚'
  },
  {
    id: 'default-debug',
    name: 'debug',
    description: 'Help debug code',
    systemPrompt: 'You are a debugging expert. Analyze code for bugs, security issues, and performance problems. Provide fixes with explanations.',
    icon: '🐛'
  },
  {
    id: 'default-es',
    name: 'es',
    description: 'Responde en español',
    systemPrompt: 'Responde siempre en español. Sé claro y natural.',
    icon: '🇪🇸'
  },
  {
    id: 'default-step',
    name: 'step',
    description: 'Step by step',
    systemPrompt: 'Break down your answer into clear, numbered steps. Be thorough and methodical.',
    icon: '📝'
  }
];

export class CommandsManager {
  constructor() {
    this.commands = [];
    this.activeCommand = null;
    this.selectedIndex = 0;
    this.filtered = [];
    this.isManageMode = false;
    this.editingId = null;

    // DOM elements (will be bound)
    this.elements = {};
  }

  bindElements(elements) {
    this.elements = elements;
    this.attachEventListeners();
  }

  init() {
    const saved = loadCommands();
    if (saved && saved.length > 0) {
      this.commands = saved;
    } else {
      this.commands = [...DEFAULT_COMMANDS];
      saveCommands(this.commands);
    }
  }

  attachEventListeners() {
    const { btn, modal, close, save, manage, remove, dropdown, input } = this.elements;

    if (btn) btn.addEventListener('click', () => this.openModal('create'));
    if (close) close.addEventListener('click', () => this.closeModal());
    if (save) save.addEventListener('click', () => this.saveCommand());
    if (manage) manage.addEventListener('click', () => this.toggleManageMode());
    if (remove) remove.addEventListener('click', () => this.clearActive());
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal();
    });

    // Input handler for slash commands
    if (input) {
      input.addEventListener('input', () => this.handleInput());
      input.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    // Hide dropdown on outside click
    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
        this.hideDropdown();
      }
    });
  }

  handleInput() {
    const { input, dropdown } = this.elements;
    if (!input) return;

    const text = input.value;
    const lastSlash = text.lastIndexOf('/');

    if (lastSlash !== -1) {
      const afterSlash = text.substring(lastSlash + 1);
      if (!afterSlash.includes(' ') && afterSlash.length <= 20) {
        this.showDropdown(afterSlash);
      } else {
        this.hideDropdown();
      }
    } else {
      this.hideDropdown();
    }
  }

  handleKeydown(e) {
    const { dropdown, input } = this.elements;
    if (!dropdown || !dropdown.classList.contains('show')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % this.filtered.length;
      this.renderDropdown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + this.filtered.length) % this.filtered.length;
      this.renderDropdown();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (this.filtered[this.selectedIndex]) {
        this.select(this.filtered[this.selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      this.hideDropdown();
    }
  }

  showDropdown(filter = '') {
    this.filtered = this.commands.filter(c =>
      c.name.includes(filter.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(filter.toLowerCase()))
    );

    this.selectedIndex = 0;
    this.renderDropdown();
    if (this.elements.dropdown) {
      this.elements.dropdown.classList.add('show');
    }
  }

  hideDropdown() {
    if (this.elements.dropdown) {
      this.elements.dropdown.classList.remove('show');
    }
  }

  renderDropdown() {
    const { dropdown } = this.elements;
    if (!dropdown) return;

    if (this.filtered.length === 0) {
      dropdown.innerHTML = '<div class="commands-list-header">No commands found</div>';
      return;
    }

    const html = [
      '<div class="commands-list-header">Commands</div>',
      ...this.filtered.map((cmd, idx) => `
        <div class="command-item ${idx === this.selectedIndex ? 'selected' : ''}" data-index="${idx}">
          <span class="cmd-icon">${cmd.icon || '⚡'}</span>
          <div class="cmd-info">
            <div class="cmd-name">/${cmd.name}</div>
            <div class="cmd-desc">${cmd.description || 'No description'}</div>
          </div>
        </div>
      `),
      '<div class="commands-manage" id="dropdown-manage">+ Manage commands</div>'
    ].join('');

    dropdown.innerHTML = html;

    // Attach click handlers
    dropdown.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        this.select(this.filtered[idx]);
      });
    });

    const manageBtn = document.getElementById('dropdown-manage');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => {
        this.hideDropdown();
        this.openModal('manage');
      });
    }
  }

  select(cmd) {
    this.hideDropdown();
    this.activeCommand = cmd;
    this.updateBadge();

    const { input } = this.elements;
    if (input) {
      const text = input.value;
      const lastSlash = text.lastIndexOf('/');
      if (lastSlash !== -1) {
        const beforeSlash = text.substring(0, lastSlash).trim();
        input.value = beforeSlash ? beforeSlash + ' ' : '';
      }
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input'));
    }

    return cmd;
  }

  clearActive() {
    this.activeCommand = null;
    this.updateBadge();
  }

  updateBadge() {
    const { badge, badgeIcon, badgeText } = this.elements;
    if (!badge) return;

    if (!this.activeCommand) {
      badge.classList.add('hidden');
      return;
    }

    if (badgeIcon) badgeIcon.textContent = this.activeCommand.icon || '⚡';
    if (badgeText) badgeText.textContent = `/${this.activeCommand.name}`;
    badge.classList.remove('hidden');
  }

  getActive() {
    return this.activeCommand;
  }

  // Modal methods
  openModal(mode = 'create') {
    this.isManageMode = mode === 'manage';
    this.editingId = null;

    const { modal, title, form, saveBtn, manageBtn, list } = this.elements;
    if (!modal) return;

    if (this.isManageMode) {
      if (title) title.textContent = 'Manage Commands';
      if (form) form.classList.add('hidden');
      if (saveBtn) saveBtn.classList.add('hidden');
      if (manageBtn) manageBtn.textContent = 'Back to Create';
      this.renderSavedCommands();
    } else {
      if (title) title.textContent = this.editingId ? 'Edit Command' : 'New Command';
      if (form) form.classList.remove('hidden');
      if (saveBtn) saveBtn.classList.remove('hidden');
      if (manageBtn) manageBtn.textContent = 'Manage';
      if (list) list.innerHTML = '';
      this.clearForm();
    }

    modal.classList.add('show');
  }

  closeModal() {
    if (this.elements.modal) {
      this.elements.modal.classList.remove('show');
    }
    this.isManageMode = false;
    this.editingId = null;
  }

  toggleManageMode() {
    if (this.isManageMode) {
      this.openModal('create');
    } else {
      this.openModal('manage');
    }
  }

  clearForm() {
    const { name, desc, prompt, icon } = this.elements;
    if (name) name.value = '';
    if (desc) desc.value = '';
    if (prompt) prompt.value = '';
    if (icon) icon.value = '';
  }

  saveCommand() {
    const { name, desc, prompt, icon } = this.elements;

    const commandName = name?.value.trim().toLowerCase().replace(/^\//, '');
    const description = desc?.value.trim();
    const systemPrompt = prompt?.value.trim();
    const emoji = icon?.value.trim() || '⚡';

    if (!commandName || !systemPrompt) {
      alert('Name and system prompt are required');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(commandName)) {
      alert('Command name can only contain letters, numbers, and hyphens');
      return;
    }

    if (this.editingId) {
      const idx = this.commands.findIndex(c => c.id === this.editingId);
      if (idx !== -1) {
        this.commands[idx] = { ...this.commands[idx], name: commandName, description, systemPrompt, icon: emoji };
      }
    } else {
      if (this.commands.some(c => c.name === commandName)) {
        alert(`Command /${commandName} already exists`);
        return;
      }

      this.commands.push({
        id: 'cmd-' + Date.now(),
        name: commandName,
        description,
        systemPrompt,
        icon: emoji
      });
    }

    saveCommands(this.commands);
    this.closeModal();
    this.clearForm();
  }

  renderSavedCommands() {
    const { list } = this.elements;
    if (!list) return;

    const userCommands = this.commands.filter(c => !c.id.startsWith('default-'));

    if (userCommands.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No custom commands yet.</p>';
      return;
    }

    list.innerHTML = userCommands.map(cmd => `
      <div class="saved-command-item">
        <span class="cmd-icon">${cmd.icon || '⚡'}</span>
        <div class="cmd-details">
          <div class="cmd-name">/${cmd.name}</div>
          <div class="cmd-desc" style="font-size: 12px; color: var(--text-secondary);">${cmd.description}</div>
        </div>
        <div class="cmd-actions">
          <button onclick="window.commandsManager.editCommand('${cmd.id}')">Edit</button>
          <button class="btn-delete" onclick="window.commandsManager.deleteCommand('${cmd.id}')">Delete</button>
        </div>
      </div>
    `).join('');
    list.classList.remove('hidden');
  }

  editCommand(id) {
    const cmd = this.commands.find(c => c.id === id);
    if (!cmd) return;

    this.editingId = id;
    this.openModal('create');

    const { name, desc, prompt, icon } = this.elements;
    if (name) name.value = cmd.name;
    if (desc) desc.value = cmd.description;
    if (prompt) prompt.value = cmd.systemPrompt;
    if (icon) icon.value = cmd.icon;
  }

  deleteCommand(id) {
    if (!confirm('Delete this command?')) return;
    this.commands = this.commands.filter(c => c.id !== id);
    saveCommands(this.commands);
    this.renderSavedCommands();
  }
}

// Make available globally for inline handlers
window.CommandsManager = CommandsManager;
