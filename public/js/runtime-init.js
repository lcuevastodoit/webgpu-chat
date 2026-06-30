// Runtime UI Controller
// Conecta el selector de runtime con la UI

// Estado actual
let currentRuntimeId = 'onnx-webgpu';

// Configuración de modelos por runtime
const runtimeConfig = {
  'onnx-webgpu': {
    modelName: 'Gemma 4',
    modelVariant: 'E2B',
    fullName: 'Gemma 4 E2B (QAT Mobile)',
    backend: 'WebGPU'
  },
  'onnx-cpu': {
    modelName: 'Gemma 4',
    modelVariant: 'E2B',
    fullName: 'Gemma 4 E2B (QAT Mobile)',
    backend: 'CPU'
  },
  'custom-endpoint': {
    modelName: 'Ollama',
    modelVariant: 'Local',
    fullName: 'Ollama Local Endpoint',
    backend: 'HTTP'
  }
};

// Detectar WebGPU
function detectCapabilities() {
  const hasWebGPU = typeof navigator !== 'undefined' && navigator.gpu !== undefined;
  if (!hasWebGPU) {
    console.log('WebGPU not available, defaulting to CPU');
    currentRuntimeId = 'onnx-cpu';
  }
  return { webgpu: hasWebGPU };
}

// Actualizar UI basado en runtime actual
function updateRuntimeUI() {
  const config = runtimeConfig[currentRuntimeId];
  if (!config) return;

  // Obtener modelo guardado si estamos en modo Ollama
  const savedOllamaModel = currentRuntimeId === 'custom-endpoint'
    ? localStorage.getItem('ollamaSelectedModel')
    : null;
  const modelDisplayName = savedOllamaModel
    ? savedOllamaModel.split(':')[0]
    : config.modelVariant;

  // Actualizar badge en top-nav
  const badgeModelName = document.getElementById('badge-model-name');
  const badgeModelVariant = document.getElementById('badge-model-variant');

  if (badgeModelName) badgeModelName.textContent = config.modelName;
  if (badgeModelVariant) badgeModelVariant.textContent = modelDisplayName;

  // Actualizar footer en sidebar
  const modelInfo = document.getElementById('model-info');
  if (modelInfo) {
    if (currentRuntimeId === 'custom-endpoint' && savedOllamaModel) {
      modelInfo.textContent = `Ollama: ${savedOllamaModel} — HTTP`;
    } else {
      modelInfo.textContent = `${config.fullName} — ${config.backend}`;
    }
  }

  // Actualizar subtítulo del empty state
  const emptySubtitle = document.getElementById('empty-subtitle');
  const emptyTitle = document.querySelector('.empty-state h2');
  if (emptySubtitle) {
    if (currentRuntimeId === 'custom-endpoint') {
      emptySubtitle.textContent = savedOllamaModel
        ? `Modelo: ${savedOllamaModel}`
        : 'Connect to your local Ollama server';
      if (emptyTitle) emptyTitle.textContent = 'Ollama Local';
    } else {
      emptySubtitle.textContent = 'Running locally in your browser via ' + config.backend;
      if (emptyTitle) emptyTitle.textContent = config.modelName + ' ' + config.modelVariant;
    }
  }

  // Mostrar/ocultar botón de cambiar modelo según el runtime
  const changeModelBtn = document.getElementById('change-model-btn');
  if (changeModelBtn) {
    if (currentRuntimeId === 'custom-endpoint') {
      changeModelBtn.classList.remove('hidden');
    } else {
      changeModelBtn.classList.add('hidden');
    }
  }

  console.log('UI updated for runtime:', currentRuntimeId);
}

// Cargar preferencia guardada
function loadSavedRuntime() {
  if (typeof localStorage === 'undefined') return;
  const saved = localStorage.getItem('selectedRuntime');
  if (saved && runtimeConfig[saved]) {
    currentRuntimeId = saved;
    console.log('Loaded saved runtime:', saved);
  }
}

// Función global para cambiar runtime
window.switchRuntime = function(runtimeId) {
  console.log('switchRuntime called:', runtimeId, 'current:', currentRuntimeId);

  if (runtimeId === currentRuntimeId) {
    console.log('Same runtime, skipping');
    return;
  }

  // Verificar si hay conversación activa
  const hasActiveConversation = window.app && window.app.chat && window.app.chat.currentChatId !== null;
  if (hasActiveConversation) {
    if (!confirm('Cambiar de runtime reiniciará el modelo. ¿Continuar?')) {
      // Revertir selector
      const selector = document.getElementById('runtime-selector');
      if (selector) selector.value = currentRuntimeId;
      return;
    }
  }

  // Guardar en localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('selectedRuntime', runtimeId);
    console.log('Saved to localStorage:', runtimeId);
  }

  // Marcar en sessionStorage que fue un cambio manual (para mostrar selector de Ollama)
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('runtimeJustChanged', 'true');
    console.log('Marked as manual change in sessionStorage');
  }

  // Recargar página
  console.log('Reloading...');
  location.reload();
};

// Inicializar
function init() {
  console.log('Initializing runtime selector...');

  // Detectar capacidades WebGPU PRIMERO
  const caps = detectCapabilities();

  // Verificar el valor actual en localStorage (puede haber sido cambiado por app-core.js)
  const currentSavedRuntime = localStorage.getItem('selectedRuntime');
  if (currentSavedRuntime && runtimeConfig[currentSavedRuntime]) {
    currentRuntimeId = currentSavedRuntime;
    console.log('Loaded current runtime from localStorage:', currentRuntimeId);
  }

  // Si no hay WebGPU y el modo actual es ONNX, verificar si debemos cambiar
  if (!caps.webgpu && (currentRuntimeId === 'onnx-webgpu' || currentRuntimeId === 'onnx-cpu')) {
    // app-core.js cambió a custom-endpoint, actualizamos
    if (currentSavedRuntime === 'custom-endpoint') {
      currentRuntimeId = 'custom-endpoint';
      console.log('Detected custom-endpoint mode (WebGPU fallback)');
    }
  }

  // Si no hay preferencia guardada y no hay WebGPU, usar CPU
  if (!localStorage.getItem('selectedRuntime') && !caps.webgpu) {
    currentRuntimeId = 'onnx-cpu';
    console.log('No saved preference, WebGPU not available, using CPU');
  }

  // Actualizar selector con valor final
  const selector = document.getElementById('runtime-selector');
  if (selector) {
    selector.value = currentRuntimeId;
    console.log('Selector set to:', currentRuntimeId);
  } else {
    console.error('Selector not found!');
  }

  // Actualizar UI
  updateRuntimeUI();

  // Deshabilitar WebGPU si no disponible
  if (!caps.webgpu) {
    const webgpuOption = document.querySelector('#runtime-selector option[value="onnx-webgpu"]');
    if (webgpuOption) {
      webgpuOption.disabled = true;
      webgpuOption.textContent = 'ONNX WebGPU (no disponible)';
    }
  }

  console.log('Runtime selector initialized:', currentRuntimeId);

  // Escuchar evento cuando se carga un modelo Ollama para actualizar la UI
  window.addEventListener('ollamaModelLoaded', (e) => {
    console.log('Ollama model loaded event received:', e.detail?.model);
    updateRuntimeUI();
  });
}

// Inicializar cuando el DOM esté listo
function waitForDOM() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM readyState is 'complete' or 'interactive', but we need to ensure
    // all HTML has been parsed. Use requestAnimationFrame for next paint cycle.
    requestAnimationFrame(() => {
      requestAnimationFrame(init);
    });
  }
}

// Iniciar
waitForDOM();
