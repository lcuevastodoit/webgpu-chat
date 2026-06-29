// Main application entry point

import { ChatManager } from './chat.js';
import { CommandsManager } from './commands.js';
import { ModelManager } from './model.js';
import { formatBytes } from './utils.js';

class App {
  constructor() {
    this.chat = new ChatManager();
    this.commands = new CommandsManager();
    this.model = new ModelManager();
    this.isGenerating = false;
    this.abortController = null;
    this.webSearchEnabled = true;

    this.bindElements();
  }

  toggleWebSearch() {
    this.webSearchEnabled = !this.webSearchEnabled;
    this.updateWebSearchUI();
  }

  updateWebSearchUI() {
    const btn = document.getElementById('web-search-btn');
    const input = document.getElementById('input');

    if (btn) {
      btn.classList.toggle('active', this.webSearchEnabled);
      btn.title = this.webSearchEnabled
        ? 'Web search ON - Will search before responding'
        : 'Search web (uses context)';
    }

    if (input) {
      input.placeholder = this.webSearchEnabled
        ? 'Ask anything (web search enabled)...'
        : 'Message Gemma...';
    }
  }

  async searchWeb(query) {
    // Strategy: Classify query type first, then search appropriate sources
    try {
      // Step 1: Use LLM to classify the query type
      const category = await this.classifyQueryWithLLM(query);
      console.log('Query classified as:', category);

      const topic = query
        .toLowerCase()
        .replace(/^(que es una|que es un|que son|que es|what is|what are|how to|como|por que|why|cuando|when|donde|where)\s+/i, '')
        .replace(/\s+(en|in)\s+(ruby|rails|javascript|js|python|java|html|css)\b.*/i, '') // Remove "en ruby", "in javascript", etc.
        .replace(/\?$/g, '')
        .trim();

      console.log('Extracted topic:', topic);

      // Step 2: Search based on category - prioritized sources
      const sources = [];
      const isProgrammingQuery = /\b(ruby|rails|proc|lambda|block|method|class|module|gem|irb|rake)\b/i.test(query);
      console.log('Is programming query:', isProgrammingQuery);

      switch (category) {
        case 'DEFINITION':
          // Concept/definition questions → Wikipedia first
          sources.push(
            this.fetchSource('Wikipedia ES', `https://r.jina.ai/http://es.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`),
            this.fetchSource('Wikipedia EN', `https://r.jina.ai/http://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`)
          );
          // Fallback for programming-specific terms
          if (isProgrammingQuery) {
            sources.push(
              this.fetchDuckDuckGoResults(`${query} ruby`, 'Ruby Documentation'),
              this.fetchDuckDuckGoResults(`site:stackoverflow.com ${query}`, 'Stack Overflow')
            );
          } else {
            // General fallback to DuckDuckGo for non-programming queries
            sources.push(
              this.fetchDuckDuckGoResults(query, 'Web Search')
            );
          }
          break;

        case 'CODE_EXAMPLE':
          // Code examples → Stack Overflow, GitHub, tutorials
          sources.push(
            this.fetchDuckDuckGoResults(`site:stackoverflow.com ${query}`, 'Stack Overflow'),
            this.fetchDuckDuckGoResults(`site:github.com ${query}`, 'GitHub'),
            this.fetchAndExtractUrls(query, true)
          );
          break;

        case 'DOCUMENTATION':
          // Language/framework specific → Official docs
          if (/\b(ruby|rails)\b/i.test(query)) {
            sources.push(
              this.fetchSource('Ruby Docs', `https://r.jina.ai/http://ruby-doc.org/core-3.1.0/${encodeURIComponent(topic.replace(/\s+/g, '_'))}.html`)
            );
          }
          if (/\b(js|javascript|css|html|dom|web)\b/i.test(query)) {
            sources.push(
              this.fetchSource('MDN Web Docs', `https://r.jina.ai/http://developer.mozilla.org/en-US/docs/Web/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`)
            );
          }
          sources.push(
            this.fetchDuckDuckGoResults(`${query} documentation`, 'Documentation'),
            this.fetchAndExtractUrls(query, true)
          );
          break;

        case 'TUTORIAL':
          // How-to tutorials → Dev.to, Medium, tutorials
          sources.push(
            this.fetchDuckDuckGoResults(`site:dev.to OR site:medium.com ${query}`, 'Tutorials'),
            this.fetchDuckDuckGoResults(`site:stackoverflow.com ${query}`, 'Stack Overflow'),
            this.fetchAndExtractUrls(query, true)
          );
          break;

        case 'COMPARISON':
          // Comparisons → Wikipedia + articles
          sources.push(
            this.fetchSource('Wikipedia ES', `https://r.jina.ai/http://es.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`),
            this.fetchSource('Wikipedia EN', `https://r.jina.ai/http://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`),
            this.fetchAndExtractUrls(query, true)
          );
          // Fallback
          sources.push(this.fetchDuckDuckGoResults(query, 'Web Search'));
          break;

        default:
          // GENERAL - balanced approach
          sources.push(
            this.fetchSource('Wikipedia ES', `https://r.jina.ai/http://es.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`),
            this.fetchSource('Wikipedia EN', `https://r.jina.ai/http://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`),
            this.fetchDuckDuckGoResults(`site:stackoverflow.com ${query}`, 'Stack Overflow'),
            this.fetchAndExtractUrls(query, true),
            // Ensure at least DuckDuckGo works as last resort
            this.fetchDuckDuckGoResults(query, 'Web Search')
          );
      }

      // Fetch sources in parallel
      const results = await Promise.all(sources);
      const validSources = results.filter(s => s && s.content && s.content.length > 500);

      console.log('Valid sources found:', validSources.length, 'for category:', category);

      if (validSources.length === 0) {
        return 'No useful content found from web sources.';
      }

      if (validSources.length === 1) {
        const source = validSources[0];
        return `From ${source.name}:\n\n${source.content.slice(0, 8000)}`;
      }

      // Use LLM to select the best source from valid ones
      console.log('Using LLM to select best source...');
      const selectedContent = await this.selectBestSourceWithLLM(query, validSources, category);

      return selectedContent;

    } catch (err) {
      console.error('Web search error:', err);
      return `Search error: ${err.message}`;
    }
  }

  async classifyQueryWithLLM(query) {
    // LLM is the PRIMARY classifier - no JS fallback regex
    const classificationPrompt = [
      {
        role: 'system',
        content: `You are a query classifier. Analyze the user's question and classify it into exactly one of these categories:\n\nDEFINITION - Questions asking "what is", "what are", "explain" - seeking conceptual understanding\nCODE_EXAMPLE - Questions asking for code examples, "how to write", "show me code", syntax questions\nDOCUMENTATION - Questions about specific functions, methods, APIs, "what does X do", reference questions\nTUTORIAL - Questions asking "how to", "steps to", "guide me", "tutorial for" - step by step instructions\nCOMPARISON - Questions comparing things: "vs", "difference between", "which is better"\nGENERAL - Other questions that don't fit above\n\nRespond with ONLY the category name. No punctuation, no explanation, just the category.`
      },
      {
        role: 'user',
        content: `Query: "${query}"\n\nCategory:`
      }
    ];

    try {
      const classification = await this.model.generateSingle(classificationPrompt, { maxNewTokens: 20 });
      const rawCategory = classification.trim();

      // Map LLM responses to valid categories (fuzzy matching)
      const categoryMap = {
        'DEFINITION': ['DEFINITION', 'DEFINICION', 'DEFINITION_TYPE', 'CONCEPT'],
        'CODE_EXAMPLE': ['CODE_EXAMPLE', 'CODE', 'EXAMPLE', 'CODE_EXAMPLES', 'SYNTAX', 'CODING'],
        'DOCUMENTATION': ['DOCUMENTATION', 'DOCS', 'REFERENCE', 'API', 'FUNCTION'],
        'TUTORIAL': ['TUTORIAL', 'HOW_TO', 'HOWTO', 'GUIDE', 'STEP_BY_STEP', 'INSTRUCTIONS'],
        'COMPARISON': ['COMPARISON', 'COMPARE', 'VERSUS', 'DIFFERENCE', 'VS'],
        'GENERAL': ['GENERAL', 'OTHER', 'MISC', 'UNKNOWN']
      };

      const upperCategory = rawCategory.toUpperCase().replace(/[^A-Z_]/g, '');

      // Find matching category
      for (const [canonical, aliases] of Object.entries(categoryMap)) {
        if (aliases.includes(upperCategory) || upperCategory === canonical) {
          console.log('LLM classified as:', canonical);
          return canonical;
        }
      }

      // If no match, try to infer from the raw text
      if (/\b(definicion|definir|que es|what is|concepto|concept)\b/i.test(rawCategory)) return 'DEFINITION';
      if (/\b(codigo|code|ejemplo|example|sintaxis|syntax)\b/i.test(rawCategory)) return 'CODE_EXAMPLE';
      if (/\b(como|how to|pasos|steps|guia|guide)\b/i.test(rawCategory)) return 'TUTORIAL';
      if (/\b(documentation|docs|referencia|reference)\b/i.test(rawCategory)) return 'DOCUMENTATION';
      if (/\b(comparar|compare|vs|versus|diferencia|difference)\b/i.test(rawCategory)) return 'COMPARISON';

      console.log('LLM classification unclear, defaulting to GENERAL:', rawCategory);
      return 'GENERAL';

    } catch (err) {
      console.error('LLM classification error:', err);
      return 'GENERAL';
    }
  }

  async fetchSource(name, url) {
    try {
      const response = await fetch(url);
      const text = await response.text();

      // Validate content - stricter checks for Wikipedia 404s
      const isValid = text.length > 1000 &&
                       !text.includes('404:') &&
                       !text.includes('404 Not Found') &&
                       !text.includes('does not exist') &&
                       !text.includes('no existe') &&
                       !text.includes('may refer to') &&
                       !text.includes('puede referirse') &&
                       !text.includes('Contenido de la página no disponible') &&
                       !text.includes('redlink');

      if (!isValid) {
        console.log(`Source ${name} invalid:`, text.slice(0, 200));
        return null;
      }

      return { name, content: text.slice(0, 6000), length: text.length };
    } catch (e) {
      console.log(`Failed to fetch ${name}:`, e.message);
      return null;
    }
  }

  async fetchDuckDuckGoResults(searchQuery, sourceName) {
    // Search DuckDuckGo and extract content from top result
    const ddgUrl = `https://r.jina.ai/http://lite.duckduckgo.com/lite/?q=${encodeURIComponent(searchQuery)}`;
    try {
      const response = await fetch(ddgUrl);
      const ddgText = await response.text();

      if (ddgText.length < 500 || ddgText.includes('CAPTCHA')) {
        return null;
      }

      // Try to extract the first actual result URL
      const urlRegex = /https?:\/\/[^\s\)\]\>]+/g;
      const urls = [...ddgText.matchAll(urlRegex)].map(m => m[0]);

      // Filter for relevant domains
      const goodDomains = [
        'stackoverflow.com', 'github.com', 'dev.to', 'medium.com',
        'freecodecamp.org', 'w3schools.com', 'tutorialspoint.com',
        'geeksforgeeks.org', 'rubyguides.com', 'railsinsights.com',
        'delftstack.com', 'rubentejera.com', 'piproductora.com',
        'learntutorials.net', 'codecademy.com', 'digitalocean.com',
        'mozilla.org', 'ruby-doc.org', 'api.rubyonrails.org'
      ];

      const blockedDomains = ['reddit.com', 'linkedin.com', 'pinterest.com', 'facebook.com', 'twitter.com', 'x.com', 'quora.com'];

      const candidateUrls = urls.filter(url => {
        try {
          const domain = new URL(url).hostname;
          const isGood = goodDomains.some(good => domain.includes(good));
          const isBlocked = blockedDomains.some(bad => domain.includes(bad));
          return isGood && !isBlocked;
        } catch {
          return false;
        }
      });

      if (candidateUrls.length === 0) {
        // Return DuckDuckGo summary if no good URLs
        return { name: sourceName || 'Web Search', content: ddgText.slice(0, 4000), length: ddgText.length };
      }

      // Try to extract content from the best URL
      // But don't fail if extraction doesn't work (e.g., requires login)
      const bestUrl = candidateUrls[0];
      console.log(`Trying to extract from: ${bestUrl}`);

      try {
        const extractUrl = `https://r.jina.ai/http://${bestUrl.replace(/^https?:\/\//, '')}`;
        const extractResponse = await fetch(extractUrl);
        const extractText = await extractResponse.text();

        // Check if extraction was successful and not blocked
        const isBlocked = extractText.includes('login') ||
                          extractText.includes('sign in') ||
                          extractText.includes('sign up') ||
                          extractText.includes('403') ||
                          extractText.includes('access denied') ||
                          extractText.length < 500;

        if (extractText.length > 1000 && !extractText.includes('404') && !isBlocked) {
          console.log(`Successfully extracted from ${bestUrl}`);
          return { name: sourceName || 'Web Article', content: extractText.slice(0, 6000), length: extractText.length };
        }

        console.log(`Extraction blocked or failed for ${bestUrl}, using DDG summary`);
      } catch (extractErr) {
        console.log(`Extraction error for ${bestUrl}:`, extractErr.message);
      }

      // Fallback: return DuckDuckGo results with the URL included
      const enhancedContent = `Search results for "${searchQuery}":\n\n${ddgText.slice(0, 4000)}\n\nTop result: ${bestUrl}`;
      return { name: sourceName || 'Web Search', content: enhancedContent, length: enhancedContent.length };
    } catch (e) {
      console.log(`Failed to fetch ${sourceName}:`, e.message);
      return null;
    }
  }

  async fetchAndExtractUrls(query, isTechnical) {
    // Get DuckDuckGo results with technical boost
    let searchQuery = query;
    if (isTechnical) {
      // Boost technical queries with programming terms
      searchQuery = `${query} programming tutorial`;
    }

    const ddgUrl = `https://r.jina.ai/http://lite.duckduckgo.com/lite/?q=${encodeURIComponent(searchQuery)}`;
    try {
      const response = await fetch(ddgUrl);
      const ddgText = await response.text();

      // Extract URLs from results
      const urlRegex = /https?:\/\/[^\s\)\]\>]+/g;
      const urls = [...ddgText.matchAll(urlRegex)].map(m => m[0]);

      const goodDomains = [
        'github.com', 'stackoverflow.com', 'dev.to', 'medium.com',
        'freecodecamp.org', 'w3schools.com', 'tutorialspoint.com',
        'geeksforgeeks.org', 'rubyguides.com', 'railsinsights.com',
        'delftstack.com', 'rubentejera.com', 'piproductora.com',
        'learntutorials.net', 'codecademy.com', 'digitalocean.com',
        'mozilla.org', 'ruby-doc.org', 'api.rubyonrails.org'
      ];

      const blockedDomains = ['reddit.com', 'linkedin.com', 'pinterest.com', 'facebook.com', 'twitter.com', 'x.com'];

      const candidateUrls = urls.filter(url => {
        try {
          const domain = new URL(url).hostname;
          const isGood = goodDomains.some(good => domain.includes(good));
          const isBlocked = blockedDomains.some(bad => domain.includes(bad));
          return isGood && !isBlocked;
        } catch {
          return false;
        }
      }).slice(0, 2);

      if (candidateUrls.length === 0) return null;

      // Fetch content from URLs in parallel
      const contents = await Promise.all(
        candidateUrls.map(url => this.fetchSource('Web Article', `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`))
      );

      const validContents = contents.filter(c => c);
      if (validContents.length === 0) return null;

      // Combine multiple web articles
      const combinedContent = validContents.map(c => c.content).join('\n\n---\n\n');
      return { name: 'Web Articles', content: combinedContent, length: combinedContent.length };
    } catch (e) {
      console.log('Failed to fetch from DuckDuckGo:', e.message);
      return null;
    }
  }

  async selectBestSourceWithLLM(query, sources, category = 'GENERAL') {
    // Build prompt for LLM to evaluate sources
    const sourcesText = sources.map((s, i) =>
      `--- SOURCE ${i + 1}: ${s.name} ---\n${s.content.slice(0, 2000)}\n`
    ).join('\n');

    const categoryGuidance = {
      'DEFINITION': 'Prefer sources with clear explanations and definitions (Wikipedia preferred).',
      'CODE_EXAMPLE': 'Prefer sources with working code examples (Stack Overflow, GitHub preferred).',
      'DOCUMENTATION': 'Prefer official documentation sources (Ruby Docs, MDN preferred).',
      'TUTORIAL': 'Prefer sources with step-by-step instructions (Dev.to, tutorials preferred).',
      'COMPARISON': 'Prefer sources with balanced comparisons (Wikipedia, articles preferred).',
      'GENERAL': 'Prefer comprehensive sources with clear information.'
    };

    const evalPrompt = [
      {
        role: 'system',
        content: `You are a helpful assistant that evaluates web search results. Given a user query and multiple web sources, select the single best source.\n\nQuery type: ${category}\nGuidance: ${categoryGuidance[category] || categoryGuidance['GENERAL']}\n\nOutput ONLY the name of the best source (e.g., "Wikipedia ES", "Stack Overflow", "Ruby Docs", etc.).`
      },
      {
        role: 'user',
        content: `User query: "${query}"\n\nAvailable sources:\n${sourcesText}\n\nWhich source best answers the user's query? Output only the source name:`
      }
    ];

    try {
      // Quick generation with low token count for selection
      const selection = await this.model.generateSingle(evalPrompt, { maxNewTokens: 50 });
      const selectedName = selection.trim();

      console.log('LLM selected:', selectedName, 'for category:', category);

      // Find the selected source
      const selectedSource = sources.find(s =>
        selectedName.toLowerCase().includes(s.name.toLowerCase()) ||
        s.name.toLowerCase().includes(selectedName.toLowerCase())
      );

      if (selectedSource) {
        return `From ${selectedSource.name} (category: ${category.toLowerCase()}):\n\n${selectedSource.content.slice(0, 8000)}`;
      }

      // Fallback: use the longest/best source
      const bestSource = sources.sort((a, b) => b.content.length - a.content.length)[0];
      return `From ${bestSource.name} (category: ${category.toLowerCase()}):\n\n${bestSource.content.slice(0, 8000)}`;

    } catch (err) {
      console.error('LLM selection error:', err);
      // Fallback: return combined sources
      const combined = sources.map(s => `From ${s.name}:\n${s.content.slice(0, 4000)}`).join('\n\n---\n\n');
      return `Category: ${category.toLowerCase()}\n\n${combined}`;
    }
  }

  bindElements() {
    // Chat elements
    this.chat.bindElements({
      container: document.getElementById('chat-container'),
      history: document.getElementById('chat-history'),
      emptyState: document.getElementById('empty-state'),
      inputContainer: document.getElementById('input-container'),
      sidebar: document.getElementById('sidebar'),
      overlay: document.getElementById('overlay')
    });

    // Commands elements
    this.commands.bindElements({
      btn: document.getElementById('commands-btn'),
      modal: document.getElementById('commands-modal'),
      close: document.getElementById('modal-close'),
      save: document.getElementById('btn-save'),
      manage: document.getElementById('btn-manage'),
      remove: document.getElementById('remove-cmd'),
      dropdown: document.getElementById('commands-dropdown'),
      input: document.getElementById('input'),
      badge: document.getElementById('command-badge'),
      badgeIcon: document.getElementById('command-badge-icon'),
      badgeText: document.getElementById('command-badge-text'),
      name: document.getElementById('cmd-name'),
      desc: document.getElementById('cmd-desc'),
      prompt: document.getElementById('cmd-prompt'),
      icon: document.getElementById('cmd-icon'),
      form: document.getElementById('command-form'),
      list: document.getElementById('saved-commands-list')
    });

    // Model elements
    this.model.bindElements({
      statusDot: document.getElementById('status-dot'),
      statusText: document.getElementById('status-text')
    });

    // Make available globally for inline handlers
    window.chatManager = this.chat;
    window.commandsManager = this.commands;
    window.app = this;
  }

  async init() {
    // Initialize modules
    this.chat.init();
    this.commands.init();

    // Bind UI events
    this.bindEvents();

    // Activate web search button by default
    this.updateWebSearchUI();

    // Check model status
    await this.initializeModel();
  }

  bindEvents() {
    // New chat button
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.chat.startNewChat());
    }

    // Mobile menu
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (menuBtn && sidebar && overlay) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
      });

      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }

    // Input events
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          // Don't send if commands dropdown is visible
          const dropdown = document.getElementById('commands-dropdown');
          if (!dropdown?.classList.contains('show')) {
            this.sendMessage();
          }
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Load buttons
    const downloadBtn = document.getElementById('download-model-btn');
    const loadCdnBtn = document.getElementById('load-cdn-btn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadModel());
    }

    if (loadCdnBtn) {
      loadCdnBtn.addEventListener('click', () => this.loadFromCDN());
    }
  }

  async initializeModel() {
    console.log('initializeModel called');
    const checkingState = document.getElementById('checking-state');
    const loadingLocalState = document.getElementById('loading-local-state');
    const cdnLoadState = document.getElementById('cdn-load-state');
    const emptySubtitle = document.getElementById('empty-subtitle');

    // Check if using Ollama/Local endpoint
    const selectedRuntime = localStorage.getItem('selectedRuntime') || 'onnx-webgpu';
    console.log('selectedRuntime:', selectedRuntime);
    if (selectedRuntime === 'custom-endpoint') {
      console.log('Calling initializeOllamaModel');
      return this.initializeOllamaModel();
    }

    // Show checking state
    if (emptySubtitle) emptySubtitle.classList.add('hidden');
    if (checkingState) checkingState.classList.remove('hidden');

    try {
      const status = await this.model.checkLocalStatus();

      if (checkingState) checkingState.classList.add('hidden');

      if (status.exists) {
        // Load from local
        if (loadingLocalState) loadingLocalState.classList.remove('hidden');

        await this.model.loadFromLocal((event) => {
          if (event.status === 'weights' && event.fraction) {
            const fill = document.getElementById('local-progress-fill');
            const text = document.getElementById('local-progress-text');
            if (fill) fill.style.width = (event.fraction * 100) + '%';
            if (text) {
              const loaded = event.loaded || 0;
              const total = event.total || 0;
              text.textContent = `Loading: ${formatBytes(loaded)} / ${formatBytes(total)}`;
            }
          }
        });

        this.showChat();
      } else {
        // Show CDN load option
        if (emptySubtitle) emptySubtitle.classList.remove('hidden');
        if (cdnLoadState) cdnLoadState.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Initialization error:', err);
      if (checkingState) checkingState.classList.add('hidden');
      if (emptySubtitle) emptySubtitle.classList.remove('hidden');
      if (cdnLoadState) cdnLoadState.classList.remove('hidden');
    }
  }

  async initializeOllamaModel() {
    const checkingState = document.getElementById('checking-state');
    const ollamaState = document.getElementById('ollama-state');
    const emptyState = document.getElementById('empty-state');
    const selector = document.getElementById('ollama-model-selector');
    const status = document.getElementById('ollama-status');

    if (checkingState) checkingState.classList.add('hidden');
    if (emptyState) emptyState.style.display = 'none'; // Hide the entire empty-state
    if (ollamaState) ollamaState.classList.remove('hidden');

    try {
      // Fetch available models from Ollama
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) throw new Error('Ollama not responding');

      const data = await response.json();
      const models = data.models || [];

      if (selector) {
        selector.innerHTML = '';
        if (models.length === 0) {
          selector.innerHTML = '<option>No models found</option>';
          if (status) status.textContent = 'Install models with: ollama pull <model>';
        } else {
          models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            selector.appendChild(option);
          });
          if (status) status.textContent = `${models.length} model(s) available`;
        }

        // Handle model selection
        selector.addEventListener('change', async (e) => {
          if (!e.target.value) return;

          selector.disabled = true;
          if (status) status.textContent = `Loading ${e.target.value}...`;

          try {
            // Initialize the endpoint runtime with selected model
            await this.model.initOllamaRuntime(e.target.value);
            // Hide ollama state and show chat
            if (ollamaState) ollamaState.classList.add('hidden');
            this.showChat();
          } catch (err) {
            console.error('Failed to load Ollama model:', err);
            if (status) status.textContent = 'Error: ' + err.message;
            selector.disabled = false;
          }
        });
      }
    } catch (err) {
      console.error('Ollama connection error:', err);
      if (selector) {
        selector.innerHTML = '<option>Ollama not available</option>';
        selector.disabled = true;
      }
      if (status) {
        status.textContent = 'Make sure Ollama is running on localhost:11434';
      }
    }
  }

  async downloadModel() {
    const btn = document.getElementById('download-model-btn');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = 'Downloading... Check terminal';

    try {
      const response = await fetch('/api/download-model', { method: 'POST' });
      const result = await response.json();
      alert(result.message + ' Refresh when complete.');
    } catch (err) {
      alert('Error starting download: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = 'Download Model (~2.3GB)';
    }
  }

  async loadFromCDN() {
    const cdnLoadState = document.getElementById('cdn-load-state');
    const progressBar = document.getElementById('progress-bar');
    const emptySubtitle = document.getElementById('empty-subtitle');

    if (cdnLoadState) cdnLoadState.classList.add('hidden');
    if (emptySubtitle) emptySubtitle.classList.add('hidden');
    if (progressBar) progressBar.style.display = 'block';

    try {
      await this.model.loadFromCDN((event) => {
        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');

        if (event.status === 'weights' && event.fraction) {
          const loaded = event.loaded || 0;
          const total = event.total || 0;
          if (text) {
            text.textContent = `Loading: ${formatBytes(loaded)} / ${formatBytes(total)} (${Math.round(event.fraction * 100)}%)`;
          }
          if (fill) fill.style.width = (4 + event.fraction * 96) + '%';
        }
      });

      this.showChat();
    } catch (err) {
      console.error('CDN load error:', err);
      if (cdnLoadState) cdnLoadState.classList.remove('hidden');
    }
  }

  showChat() {
    const emptyState = document.getElementById('empty-state');
    const inputContainer = document.getElementById('input-container');
    const loadingLocalState = document.getElementById('loading-local-state');
    const progressBar = document.getElementById('progress-bar');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    if (emptyState) emptyState.style.display = 'none';
    if (loadingLocalState) loadingLocalState.classList.add('hidden');
    if (progressBar) progressBar.style.display = 'none';
    if (inputContainer) inputContainer.style.display = 'block';
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (sendBtn) sendBtn.disabled = false;

    // Create first chat if needed
    if (!this.chat.currentChatId) {
      this.chat.startNewChat();
    }
  }

  async sendMessage(userText = null) {
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    if (!this.model.isReady || this.isGenerating) return;

    const text = userText || input?.value?.trim();
    if (!text) return;

    // Clear input if not regenerating
    if (!userText && input) {
      input.value = '';
      input.style.height = 'auto';
    }

    this.isGenerating = true;
    this.abortController = new AbortController();

    if (input) input.disabled = true;
    if (sendBtn) {
      sendBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12" rx="2"></rect>
        </svg>
      `;
      sendBtn.title = 'Stop generation';
      sendBtn.onclick = () => this.stopGeneration();
      sendBtn.disabled = false;
    }

    // Prepare messages
    let chatMessages = [...this.chat.getMessages()];

    // Add system prompt if active command
    const activeCmd = this.commands.getActive();
    if (activeCmd) {
      if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
        chatMessages.unshift({
          role: 'system',
          content: activeCmd.systemPrompt
        });
      }
    }

    // Web search if enabled
    let webContext = '';
    if (this.webSearchEnabled && !userText) {
      const searchIndicator = this.chat.addMessage('🔍 Searching web...', 'system');
      webContext = await this.searchWeb(text);
      if (searchIndicator) searchIndicator.remove();

      if (webContext) {
        // Extract source name from the web context
        const sourceMatch = webContext.match(/^From\s+([^:]+)/);
        const sourceName = sourceMatch ? sourceMatch[1] : 'web search';

        // Show which source was selected by the LLM
        this.chat.addWebSearchResult(`Selected source: ${sourceName}\n\n${webContext}`);

        // Add to context for the model
        chatMessages.push({
          role: 'system',
          content: `The following web search results may help answer the user's question:\n\n${webContext}`
        });
      }
    }

    // Add user message (only if not regenerating)
    if (!userText) {
      this.chat.addMessage(text, 'user');
      this.chat.addToMessages({ role: 'user', content: text });
    }
    chatMessages.push({ role: 'user', content: text });

    // Add typing indicator
    const typingId = this.chat.addTypingIndicator();
    let reply = '';

    try {
      console.log('Starting generation with messages:', chatMessages);

      const stream = this.model.generate(chatMessages, { maxNewTokens: 4096 });

      for await (const { text: full } of stream) {
        reply = full;
        this.chat.updateTypingIndicator(typingId, reply);
      }

      this.chat.removeTypingIndicator(typingId);
      if (reply) {
        this.chat.addMessage(reply, 'assistant');
        this.chat.addToMessages({ role: 'assistant', content: reply });
      }

      this.chat.saveCurrentChat();
    } catch (err) {
      console.error('Generation error:', err);
      this.chat.removeTypingIndicator(typingId);
      this.chat.addMessage('Error: ' + err.message, 'error');
    }

    this.isGenerating = false;
    this.abortController = null;

    if (input) input.disabled = false;
    if (sendBtn) {
      sendBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      `;
      sendBtn.title = 'Send message';
      sendBtn.onclick = () => this.sendMessage();
      sendBtn.disabled = false;
    }
    if (input) input.focus();
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async regenerateFromEdit(userText) {
    // This is called when editing the last user message or regenerating
    // userText is the (possibly edited) text to send
    await this.sendMessage(userText);
  }

  // Runtime switching
  switchRuntime(runtimeId) {
    console.log('App.switchRuntime called:', runtimeId);

    const runtimeConfig = {
      'onnx-webgpu': { name: 'ONNX WebGPU' },
      'onnx-cpu': { name: 'ONNX CPU' },
      'custom-endpoint': { name: 'Endpoint Local' }
    };

    if (!runtimeConfig[runtimeId]) {
      console.error('Invalid runtime:', runtimeId);
      return;
    }

    // Check if there's an active conversation
    if (this.chat && this.chat.currentChatId !== null) {
      if (!confirm('Cambiar de runtime reiniciará el modelo. ¿Continuar?')) {
        // Revert selector
        const selector = document.getElementById('runtime-selector');
        const saved = localStorage.getItem('selectedRuntime') || 'onnx-webgpu';
        if (selector) selector.value = saved;
        return;
      }
    }

    // Save to localStorage
    localStorage.setItem('selectedRuntime', runtimeId);
    console.log('Saved runtime:', runtimeId);

    // Reload page
    location.reload();
  }

  // Check if there's an active conversation
  hasActiveConversation() {
    return this.chat && this.chat.currentChatId !== null;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Check WebGPU support
  if (!navigator.gpu) {
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #0d0d0d;
        color: #e4e4e4;
        font-family: sans-serif;
        text-align: center;
        padding: 40px;
      ">
        <h1 style="color: #ff7a6b;">WebGPU Not Supported</h1>
        <p>Please use Chrome 113+ or Edge 113+</p>
      </div>
    `;
    return;
  }

  const app = new App();
  app.init();

  // Expose app globally for runtime selector and other external calls
  window.app = app;
});
