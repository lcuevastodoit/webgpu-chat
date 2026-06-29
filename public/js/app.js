// Main application entry point
// Refactored into feature-based modules

import { App, initApp } from './core/app-core.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = initApp();

  if (app) {
    console.log('Gemma 4 Chat initialized successfully');
  }
});

// Export for external use
export { App, initApp };
