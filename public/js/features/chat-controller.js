/**
 * Feature: Chat Controller
 * Maneja el envío de mensajes, generación de respuestas y control de flujo
 */

export class ChatController {
  constructor(chatManager, modelManager, webSearchManager) {
    this.chat = chatManager;
    this.model = modelManager;
    this.webSearch = webSearchManager;
    this.isGenerating = false;
    this.abortController = null;
  }

  async sendMessage(userText = null) {
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    const text = userText || (input ? input.value.trim() : '');
    if (!text) return;

    // Clear input if not from regeneration
    if (!userText && input) {
      input.value = '';
      input.style.height = 'auto';
    }

    // Add user message to chat
    const messageId = this.chat.addMessage('user', text);

    // Disable controls
    this.setGeneratingState(true);

    // Prepare messages for generation
    const messages = this.prepareMessages(text);

    // Get web search results if enabled
    let webSearchResults = null;
    if (this.webSearch.webSearchEnabled && !userText) {
      try {
        webSearchResults = await this.webSearch.search(text);
        if (webSearchResults) {
          this.chat.showWebSearchResults(messageId, webSearchResults);
        }
      } catch (err) {
        console.error('Web search failed:', err);
      }
    }

    // Generate response
    await this.generateResponse(messages, messageId);
  }

  prepareMessages(userText) {
    const messages = [];

    // Debug log
    console.log('prepareMessages - this.model:', this.model);
    console.log('prepareMessages - this.model.ollamaModel:', this.model.ollamaModel);

    // Add system message based on active model
    const systemMessage = this.model.ollamaModel
      ? `You are ${this.model.ollamaModel.split(':')[0]}, a helpful AI assistant.`
      : 'You are a helpful AI assistant.';
    console.log('prepareMessages - systemMessage:', systemMessage);
    messages.push({
      role: 'system',
      content: systemMessage
    });

    // Add web search context if available
    if (this.webSearch.webSearchEnabled) {
      messages.push({
        role: 'system',
        content: 'You have access to web search results to help answer questions.'
      });
    }

    // Add conversation history
    const history = this.chat.getConversationMessages();
    messages.push(...history);

    // Add current message
    messages.push({ role: 'user', content: userText });

    return messages;
  }

  async generateResponse(messages, messageId) {
    try {
      this.abortController = new AbortController();
      const messageElement = this.chat.addMessage('assistant', '');

      let fullText = '';
      const generator = this.model.generate(messages, {
        signal: this.abortController.signal
      });

      for await (const chunk of generator) {
        if (this.abortController.signal.aborted) break;

        if (chunk.text) {
          fullText = chunk.text;
          this.chat.updateMessage(messageElement, fullText);
        }
      }

      // Save to conversation
      this.chat.addToConversation({ role: 'assistant', content: fullText });

    } catch (err) {
      console.error('Generation error:', err);
      if (err.name !== 'AbortError') {
        this.chat.showError('Error generating response: ' + err.message);
      }
    } finally {
      this.setGeneratingState(false);
      this.abortController = null;
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isGenerating = false;
  }

  async regenerateFromEdit(userText) {
    // Remove the last assistant message
    this.chat.removeLastAssistantMessage();

    // Remove from conversation history
    this.chat.removeLastFromConversation();

    // Send the edited message
    await this.sendMessage(userText);
  }

  setGeneratingState(generating) {
    this.isGenerating = generating;

    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    if (input) input.disabled = generating;
    if (sendBtn) sendBtn.disabled = generating;
  }

  hasActiveConversation() {
    return this.chat && this.chat.currentChatId !== null;
  }
}
