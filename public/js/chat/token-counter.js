export class TokenCounter {
  updateTokenCounter(messages) {
    const counter = document.getElementById('token-count');
    const contextLabel = document.getElementById('token-context');
    if (!counter) return;

    let totalChars = 0;
    messages.forEach(msg => {
      totalChars += msg.content?.length || 0;
    });

    const estimatedTokens = Math.ceil(totalChars / 4) + (messages.length * 4);
    const contextWindow = 128000;

    counter.textContent = estimatedTokens.toLocaleString();

    if (contextLabel) {
      contextLabel.textContent = `/ 128K`;
    }

    const percentage = estimatedTokens / contextWindow;
    counter.classList.remove('token-low', 'token-medium', 'token-high');

    if (percentage < 0.5) {
      counter.classList.add('token-low');
    } else if (percentage < 0.8) {
      counter.classList.add('token-medium');
    } else {
      counter.classList.add('token-high');
    }
  }

  clearTokenCounter() {
    const counter = document.getElementById('token-count');
    if (counter) {
      counter.textContent = '0';
      counter.classList.remove('token-medium', 'token-high');
      counter.classList.add('token-low');
    }
  }
}
