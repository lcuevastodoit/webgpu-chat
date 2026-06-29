/**
 * Feature: Web Search
 * Maneja la búsqueda en internet, clasificación de queries y extracción de fuentes
 */

export class WebSearchManager {
  constructor() {
    this.webSearchEnabled = false;
    this.abortController = null;
  }

  toggle() {
    this.webSearchEnabled = !this.webSearchEnabled;
    this.updateUI();
    return this.webSearchEnabled;
  }

  updateUI() {
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

  async search(query) {
    if (!this.webSearchEnabled) return null;

    try {
      const category = await this.classifyQuery(query);
      const topic = this.extractTopic(query);

      const sources = await this.gatherSources(query, category, topic);
      const bestSource = await this.selectBestSource(query, sources, category);

      return bestSource;
    } catch (err) {
      console.error('Web search error:', err);
      return null;
    }
  }

  async classifyQuery(query) {
    // Clasificación simple basada en palabras clave
    const lowerQuery = query.toLowerCase();

    if (/\b(how to|como|cómo|ejemplo|example|tutorial)\b/i.test(lowerQuery)) {
      return 'CODE_EXAMPLE';
    }
    if (/\b(documentation|docs|api|reference|manual)\b/i.test(lowerQuery)) {
      return 'DOCUMENTATION';
    }
    if (/\b(what is|que es|define|definition|significa)\b/i.test(lowerQuery)) {
      return 'DEFINITION';
    }
    return 'GENERAL';
  }

  extractTopic(query) {
    return query
      .toLowerCase()
      .replace(/^(que es una|que es un|que son|que es|what is|what are|how to|como|cómo|por que|why|cuando|when|donde|where)\s+/i, '')
      .replace(/\s+(en|in)\s+(ruby|rails|javascript|js|python|java|html|css)\b.*/i, '')
      .replace(/\?$/g, '')
      .trim();
  }

  async gatherSources(query, category, topic) {
    const sources = [];
    const isProgrammingQuery = /\b(ruby|rails|proc|lambda|block|method|class|module|gem|irb|rake)\b/i.test(query);

    switch (category) {
      case 'DEFINITION':
        sources.push(
          this.fetchSource('Wikipedia ES', `https://r.jina.ai/http://es.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`),
          this.fetchSource('Wikipedia EN', `https://r.jina.ai/http://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`)
        );
        if (isProgrammingQuery) {
          sources.push(
            this.fetchDuckDuckGo(`${query} ruby`, 'Ruby Documentation'),
            this.fetchDuckDuckGo(`site:stackoverflow.com ${query}`, 'Stack Overflow')
          );
        } else {
          sources.push(this.fetchDuckDuckGo(query, 'Web Search'));
        }
        break;

      case 'CODE_EXAMPLE':
        sources.push(
          this.fetchDuckDuckGo(`site:stackoverflow.com ${query}`, 'Stack Overflow'),
          this.fetchDuckDuckGo(`site:github.com ${query}`, 'GitHub'),
          this.fetchAndExtractUrls(query, true)
        );
        break;

      case 'DOCUMENTATION':
        if (/\b(ruby|rails)\b/i.test(query)) {
          sources.push(
            this.fetchSource('Ruby Docs', `https://r.jina.ai/http://ruby-doc.org/core-3.1.0/${encodeURIComponent(topic.replace(/\s+/g, '_'))}.html`)
          );
        }
        sources.push(
          this.fetchDuckDuckGo(`${query} documentation`, 'Documentation'),
          this.fetchDuckDuckGo(`site:developer.mozilla.org ${query}`, 'MDN')
        );
        break;

      default:
        sources.push(
          this.fetchDuckDuckGo(query, 'Web Search'),
          this.fetchAndExtractUrls(query, false)
        );
    }

    const results = await Promise.allSettled(sources);
    return results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
  }

  async fetchSource(name, url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return { name, url, content: text.slice(0, 5000) };
    } catch (err) {
      console.error(`Failed to fetch ${name}:`, err);
      return null;
    }
  }

  async fetchDuckDuckGo(searchQuery, sourceName) {
    try {
      const response = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
          }
        }
      );
      if (!response.ok) throw new Error('DuckDuckGo failed');

      const html = await response.text();
      const results = this.parseDuckDuckGoResults(html);

      return {
        name: sourceName,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
        content: results
      };
    } catch (err) {
      console.error('DuckDuckGo search failed:', err);
      return null;
    }
  }

  parseDuckDuckGoResults(html) {
    const results = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '');
      if (url && title && !url.includes('duckduckgo.com')) {
        results.push({ title, url });
      }
    }

    return results;
  }

  async fetchAndExtractUrls(query, isTechnical) {
    try {
      const searchQuery = isTechnical ? `${query} programming tutorial` : query;
      const response = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)'
          }
        }
      );

      if (!response.ok) throw new Error('Search failed');
      const html = await response.text();

      // Extraer URLs
      const urlRegex = /href="(https?:\/\/[^"]+)"/g;
      const urls = [];
      let match;
      while ((match = urlRegex.exec(html)) !== null && urls.length < 3) {
        const url = match[1];
        if (!url.includes('duckduckgo.com') && !urls.includes(url)) {
          urls.push(url);
        }
      }

      // Extraer contenido de las URLs
      const contents = await Promise.all(
        urls.map(async (url) => {
          try {
            const response = await fetch(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`);
            if (!response.ok) return null;
            const text = await response.text();
            return { url, content: text.slice(0, 3000) };
          } catch {
            return null;
          }
        })
      );

      return {
        name: 'Extracted Sources',
        url: urls[0] || '',
        content: contents.filter(Boolean)
      };
    } catch (err) {
      console.error('URL extraction failed:', err);
      return null;
    }
  }

  async selectBestSource(query, sources, category) {
    if (!sources || sources.length === 0) return null;

    // Para DEFINITION, preferir Wikipedia
    if (category === 'DEFINITION') {
      const wiki = sources.find(s => s.name.includes('Wikipedia'));
      if (wiki) return wiki;
    }

    // Para CODE_EXAMPLE, preferir Stack Overflow o GitHub
    if (category === 'CODE_EXAMPLE') {
      const codeSource = sources.find(s =>
        s.name.includes('Stack Overflow') || s.name.includes('GitHub')
      );
      if (codeSource) return codeSource;
    }

    // Para DOCUMENTATION, preferir docs oficiales
    if (category === 'DOCUMENTATION') {
      const docSource = sources.find(s =>
        s.name.includes('Documentation') || s.name.includes('MDN')
      );
      if (docSource) return docSource;
    }

    // Default: retornar la primera fuente
    return sources[0];
  }
}
