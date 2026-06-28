// Storage management for localStorage

const STORAGE_KEYS = {
  CHATS: 'gemma-chats',
  COMMANDS: 'gemma-commands',
  SETTINGS: 'gemma-settings'
};

// Chats
export function loadChats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Error loading chats:', e);
    return [];
  }
}

export function saveChats(chats) {
  try {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats.slice(0, 20)));
  } catch (e) {
    console.error('Error saving chats:', e);
  }
}

// Commands
export function loadCommands() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.COMMANDS);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error('Error loading commands:', e);
    return null;
  }
}

export function saveCommands(commands) {
  try {
    localStorage.setItem(STORAGE_KEYS.COMMANDS, JSON.stringify(commands));
  } catch (e) {
    console.error('Error saving commands:', e);
  }
}

// Settings
export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}
