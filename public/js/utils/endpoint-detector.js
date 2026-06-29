async function scanLocalEndpoints() {
  const endpoints = [];

  // Intentar detectar Ollama
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      endpoints.push({ type: 'ollama', url: 'http://localhost:11434' });
    }
  } catch {
    // Ollama no detectado
  }

  return endpoints;
}

async function getDetectionNotification() {
  const endpoints = await scanLocalEndpoints();

  if (endpoints.length === 0) {
    return null;
  }

  const endpoint = endpoints[0];
  return {
    title: `${endpoint.type.charAt(0).toUpperCase() + endpoint.type.slice(1)} detectado`,
    message: '¿Usar como backend?',
    endpoint: endpoint
  };
}

module.exports = { scanLocalEndpoints, getDetectionNotification };
