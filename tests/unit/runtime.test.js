/**
 * Tests unitarios para Plan 1: Múltiples Runtimes
 * Basados en especificación Gherkin
 * Para TDD - Estos tests fallarán hasta implementar las funcionalidades
 */

const RuntimeAdapter = require('../../public/js/runtime/runtime-adapter');
const RuntimeRegistry = require('../../public/js/runtime/runtime-registry');
const RuntimeManager = require('../../public/js/runtime/runtime-manager');
const OnnxRuntime = require('../../public/js/runtime/onnx-runtime');
const EndpointRuntime = require('../../public/js/runtime/endpoint-runtime');

// Mock de localStorage
global.localStorage = {
  store: {},
  getItem: function(key) { return this.store[key] || null; },
  setItem: function(key, value) { this.store[key] = value; },
  removeItem: function(key) { delete this.store[key]; },
  clear: function() { this.store = {}; }
};

describe('Feature: Abstracción de Runtime para Inferencia', () => {

  beforeEach(() => {
    localStorage.clear();
  });

  describe('Escenario: Runtime por defecto (ONNX WebGPU)', () => {
    test('Given: usuario abre la app por primera vez', () => {
      // Precondición: localStorage está vacío
      expect(localStorage.getItem('selectedRuntime')).toBeNull();
    });

    test('When: la aplicación se inicializa Then: runtime por defecto es onnx-webgpu', () => {
      const manager = new RuntimeManager();

      // Al inicializar, debe seleccionar el runtime por defecto
      expect(manager.getCurrentRuntimeId()).toBe('onnx-webgpu');
    });

    test('Then: el modelo debe cargarse usando Transformers.js', async () => {
      const manager = new RuntimeManager();
      const runtime = manager.getCurrentRuntime();

      // El runtime debe ser instancia de OnnxRuntime
      expect(runtime).toBeInstanceOf(OnnxRuntime);

      // Debe usar transformers.js para cargar
      await runtime.load();
      expect(runtime.isLoaded()).toBe(true);
    });

    test('And: no se debe mostrar selector hasta que el modelo esté listo', () => {
      const manager = new RuntimeManager();

      // Mientras carga, el selector debe estar deshabilitado
      expect(manager.canShowRuntimeSelector()).toBe(false);

      // Simular que terminó de cargar
      manager.setModelLoaded(true);
      expect(manager.canShowRuntimeSelector()).toBe(true);
    });
  });

  describe('Escenario: Cambio de runtime disponible', () => {
    test('Given: usuario está en interfaz principal And: modelo está cargado', () => {
      const manager = new RuntimeManager();
      manager.setModelLoaded(true);

      expect(manager.canShowRuntimeSelector()).toBe(true);
    });

    test('When: usuario hace clic en selector Then: se muestran runtimes disponibles', () => {
      const registry = new RuntimeRegistry();
      const runtimes = registry.getAvailableRuntimes();

      // Debe haber al menos 3 runtimes
      expect(runtimes).toHaveLength(3);
      expect(runtimes).toContainEqual(
        expect.objectContaining({ id: 'onnx-webgpu', name: 'ONNX WebGPU' })
      );
      expect(runtimes).toContainEqual(
        expect.objectContaining({ id: 'onnx-cpu', name: 'ONNX CPU' })
      );
      expect(runtimes).toContainEqual(
        expect.objectContaining({ id: 'custom-endpoint', name: 'Endpoint Local' })
      );
    });

    test('Then: cada runtime tiene descripción', () => {
      const registry = new RuntimeRegistry();
      const runtimes = registry.getAvailableRuntimes();

      runtimes.forEach(runtime => {
        expect(runtime).toHaveProperty('id');
        expect(runtime).toHaveProperty('name');
        expect(runtime).toHaveProperty('description');
      });
    });
  });

  describe('Escenario: Selección de endpoint personalizado', () => {
    test('Given: usuario selecciona "Endpoint Local"', () => {
      const manager = new RuntimeManager();

      // Seleccionar endpoint
      manager.selectRuntime('custom-endpoint');

      expect(manager.getCurrentRuntimeId()).toBe('custom-endpoint');
    });

    test('When: se abre modal de configuración Then: muestra campos requeridos', () => {
      const runtime = new EndpointRuntime();
      const configFields = runtime.getRequiredConfigFields();

      // Debe tener URL y Model Name como requeridos
      const urlField = configFields.find(f => f.name === 'url');
      const modelField = configFields.find(f => f.name === 'modelName');
      const apiKeyField = configFields.find(f => f.name === 'apiKey');

      expect(urlField).toBeDefined();
      expect(urlField.required).toBe(true);
      expect(modelField).toBeDefined();
      expect(modelField.required).toBe(true);
      expect(apiKeyField).toBeDefined();
      expect(apiKeyField.required).toBe(false); // API key es opcional
    });

    test('Then: al guardar debe validar que la URL es accesible', async () => {
      const runtime = new EndpointRuntime();

      // Simular configuración inválida
      const invalidConfig = { url: 'http://invalid:11434', modelName: 'test' };

      await expect(runtime.validateConfig(invalidConfig))
        .rejects.toThrow('URL no accesible');
    });

    test('And: se almacena en localStorage', () => {
      const manager = new RuntimeManager();
      const config = { url: 'http://localhost:11434', modelName: 'llama3.2' };

      manager.saveRuntimeConfig('custom-endpoint', config);

      const saved = JSON.parse(localStorage.getItem('runtimeConfig_custom-endpoint'));
      expect(saved).toEqual(config);
    });
  });

  describe('Escenario: Carga de modelo con runtime específico', () => {
    test('Given: usuario ha seleccionado un runtime', () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('onnx-webgpu');

      expect(manager.getCurrentRuntimeId()).toBe('onnx-webgpu');
    });

    test('When: inicia nueva conversación Then: usa RuntimeAdapter correspondiente', async () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('onnx-webgpu');

      const runtime = manager.getCurrentRuntime();

      // Debe ser un RuntimeAdapter válido
      expect(runtime).toBeInstanceOf(RuntimeAdapter);
    });

    test('And: muestra indicador de carga específico del runtime', () => {
      const manager = new RuntimeManager();
      const runtime = manager.getCurrentRuntime();

      // Cada runtime debe reportar su estado de carga
      expect(runtime.getLoadingStatus()).toHaveProperty('message');
      expect(runtime.getLoadingStatus()).toHaveProperty('progress');
    });
  });

  describe('Escenario: Error en runtime seleccionado', () => {
    test('When: intenta cargar el modelo Then: detecta error de WebGPU no disponible', async () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('onnx-webgpu');

      // Simular que WebGPU no está disponible
      jest.spyOn(manager.getCurrentRuntime(), 'isAvailable').mockReturnValue(false);

      await expect(manager.loadModel()).rejects.toThrow('WebGPU no disponible');
    });

    test('And: ofrece automáticamente cambiar a ONNX CPU', async () => {
      const manager = new RuntimeManager();

      try {
        await manager.loadModel();
      } catch (error) {
        // Debe sugerir fallback
        expect(error.suggestedFallback).toBe('onnx-cpu');
      }
    });
  });

  describe('Escenario: Fallback automático en endpoint local', () => {
    test('Given: usuario configuró endpoint local And: endpoint no responde', async () => {
      const runtime = new EndpointRuntime();
      runtime.configure({ url: 'http://localhost:11434', modelName: 'test' });

      // Simular timeout
      jest.spyOn(runtime, 'generate').mockRejectedValue(new Error('Connection timeout'));

      await expect(runtime.generate('test')).rejects.toThrow('Connection timeout');
    });

    test('When: intenta enviar mensaje Then: detecta error de conexión', async () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('custom-endpoint');

      const runtime = manager.getCurrentRuntime();
      runtime.setError('CONNECTION_ERROR');

      // Debe detectar y reportar el error
      expect(runtime.hasError()).toBe(true);
      expect(runtime.getErrorType()).toBe('CONNECTION_ERROR');
    });

    test('Then: muestra modal con opciones de recuperación', () => {
      const manager = new RuntimeManager();
      manager.setError('CONNECTION_ERROR');

      const recoveryOptions = manager.getRecoveryOptions();

      expect(recoveryOptions).toContainEqual(
        expect.objectContaining({ action: 'retry', label: 'Reintentar conexión' })
      );
      expect(recoveryOptions).toContainEqual(
        expect.objectContaining({ action: 'fallback', label: 'Cambiar a runtime local' })
      );
      expect(recoveryOptions).toContainEqual(
        expect.objectContaining({ action: 'config', label: 'Ver configuración del endpoint' })
      );
    });
  });

  describe('Escenario: Persistencia de preferencia de runtime', () => {
    test('Given: usuario seleccionó Endpoint Local And: configuró URL', () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('custom-endpoint');
      manager.saveRuntimeConfig('custom-endpoint', {
        url: 'http://localhost:11434',
        modelName: 'llama3.2'
      });

      expect(localStorage.getItem('selectedRuntime')).toBe('custom-endpoint');
    });

    test('When: recarga la página Then: se recuerda la selección', () => {
      // Simular guardado previo
      localStorage.setItem('selectedRuntime', 'custom-endpoint');
      localStorage.setItem('runtimeConfig_custom-endpoint', JSON.stringify({
        url: 'http://localhost:11434',
        modelName: 'llama3.2'
      }));

      // Nueva instancia debe cargar desde localStorage
      const manager = new RuntimeManager();
      manager.loadFromStorage();

      expect(manager.getCurrentRuntimeId()).toBe('custom-endpoint');
    });

    test('And: carga automáticamente última configuración', () => {
      const savedConfig = { url: 'http://localhost:11434', modelName: 'llama3.2' };
      localStorage.setItem('runtimeConfig_custom-endpoint', JSON.stringify(savedConfig));

      const manager = new RuntimeManager();
      manager.loadFromStorage();

      expect(manager.getCurrentRuntimeConfig()).toEqual(savedConfig);
    });

    test('And: no requiere reconfiguración', () => {
      const manager = new RuntimeManager();
      manager.loadFromStorage();

      // Si hay config guardada, no debe pedir reconfiguración
      const runtime = manager.getCurrentRuntime();
      expect(runtime.isConfigured()).toBe(true);
    });
  });
});

describe('Feature: Interfaz Unificada de Runtime (SOLID)', () => {

  describe('Escenario: Contracto de RuntimeAdapter', () => {
    test('Then: RuntimeAdapter define métodos requeridos', () => {
      // RuntimeAdapter es una interfaz/clase base abstracta
      const adapter = new RuntimeAdapter();

      // Debe definir estos métodos
      expect(typeof adapter.load).toBe('function');
      expect(typeof adapter.generate).toBe('function');
      expect(typeof adapter.unload).toBe('function');
      expect(typeof adapter.isAvailable).toBe('function');
      expect(typeof adapter.getInfo).toBe('function');
    });

    test('Implementaciones deben cumplir contrato', () => {
      // OnnxRuntime implementa RuntimeAdapter
      const onnx = new OnnxRuntime();
      expect(onnx).toBeInstanceOf(RuntimeAdapter);

      // EndpointRuntime implementa RuntimeAdapter
      const endpoint = new EndpointRuntime();
      expect(endpoint).toBeInstanceOf(RuntimeAdapter);
    });

    test('Método generate() retorna AsyncGenerator', async () => {
      const onnx = new OnnxRuntime();
      await onnx.load();

      const generator = onnx.generate([{ role: 'user', content: 'test' }]);

      // Debe ser un async generator
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('Escenario: Registro de nuevos runtimes (Open/Closed Principle)', () => {
    test('Given: existe RuntimeRegistry', () => {
      const registry = new RuntimeRegistry();
      expect(registry).toBeDefined();
    });

    test('When: se registra nuevo runtime Then: está disponible en selector', () => {
      const registry = new RuntimeRegistry();

      // Registrar nuevo runtime sin modificar código existente
      const MyCustomRuntime = class extends RuntimeAdapter {
        load() { return Promise.resolve(); }
        generate() { return (async function*() {})(); }
        unload() { return Promise.resolve(); }
        isAvailable() { return true; }
        getInfo() { return { name: 'Custom', description: 'Test' }; }
      };

      registry.register('my-custom', MyCustomRuntime);

      // Debe estar disponible
      const runtimes = registry.getAvailableRuntimes();
      expect(runtimes.some(r => r.id === 'my-custom')).toBe(true);
    });

    test('Then: no requiere modificar código existente', () => {
      const registry = new RuntimeRegistry();
      const initialMethods = Object.keys(registry);

      // Registrar runtime
      const NewRuntime = class extends RuntimeAdapter {};
      registry.register('new-runtime', NewRuntime);

      // No debe añadir nuevos métodos al registry
      expect(Object.keys(registry)).toEqual(initialMethods);
    });

    test('Then: funciona con interfaz unificada', async () => {
      const registry = new RuntimeRegistry();

      // Obtener runtime por ID
      const RuntimeClass = registry.getRuntimeClass('onnx-webgpu');
      const runtime = new RuntimeClass();

      // Usar interfaz unificada
      await runtime.load();
      expect(runtime.isLoaded()).toBe(true);
    });
  });
});

describe('Feature: Experiencia de Usuario con Múltiples Runtimes', () => {

  describe('Escenario: Indicador visual de runtime activo', () => {
    test('Given: runtime está cargado Then: se muestra en barra superior', () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('onnx-webgpu');

      const indicator = manager.getStatusIndicator();

      expect(indicator).toHaveProperty('icon');
      expect(indicator).toHaveProperty('shortName');
      expect(indicator).toHaveProperty('status'); // 'ready', 'loading', 'error'
    });

    test('When: hover sobre indicador Then: muestra tooltip completo', () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('onnx-webgpu');

      const tooltip = manager.getStatusTooltip();

      expect(tooltip).toHaveProperty('runtime', 'ONNX WebGPU');
      expect(tooltip).toHaveProperty('model');
      expect(tooltip).toHaveProperty('status');
      expect(tooltip).toHaveProperty('loadTime');
    });
  });

  describe('Escenario: Cambio de runtime en caliente', () => {
    test('Given: usuario tiene conversación activa And: runtime actual es ONNX WebGPU', () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('onnx-webgpu');
      manager.setActiveConversation('conv-123');

      expect(manager.getActiveConversation()).toBe('conv-123');
    });

    test('When: usuario cambia a Endpoint Local Then: muestra advertencia', () => {
      const manager = new RuntimeManager();

      const shouldWarn = manager.shouldWarnBeforeSwitch('custom-endpoint');
      expect(shouldWarn).toBe(true);
    });

    test('And: advertencia indica reinicio del modelo', () => {
      const manager = new RuntimeManager();
      const warning = manager.getSwitchWarning('custom-endpoint');

      expect(warning.message).toContain('reiniciará el modelo');
      expect(warning.actions).toContain('cancel');
      expect(warning.actions).toContain('continue');
    });

    test('And: al aceptar, guarda conversación actual', async () => {
      const manager = new RuntimeManager();
      manager.setActiveConversation('conv-123');

      await manager.switchRuntime('custom-endpoint', { saveConversation: true });

      // La conversación debe haberse guardado
      expect(manager.wasConversationSaved('conv-123')).toBe(true);
    });

    test('And: descarga modelo actual Then: carga nuevo runtime', async () => {
      const manager = new RuntimeManager();

      const oldRuntime = manager.getCurrentRuntime();
      await oldRuntime.load();
      expect(oldRuntime.isLoaded()).toBe(true);

      await manager.switchRuntime('custom-endpoint');

      // Old runtime debe estar unload
      expect(oldRuntime.isLoaded()).toBe(false);

      // New runtime debe ser el actual
      expect(manager.getCurrentRuntimeId()).toBe('custom-endpoint');
    });

    test('And: mantiene historial de la conversación', async () => {
      const manager = new RuntimeManager();
      manager.setActiveConversation('conv-123');
      const messages = [{ role: 'user', content: 'Hola' }];
      manager.setConversationMessages('conv-123', messages);

      await manager.switchRuntime('custom-endpoint');

      // Mensajes deben persistir
      expect(manager.getConversationMessages('conv-123')).toEqual(messages);
    });
  });
});

describe('Feature: Detección de Capacidades', () => {

  describe('Escenario: Detección automática de WebGPU', () => {
    test('Given: aplicación se inicia When: detecta capacidades', () => {
      const detector = require('../../public/js/utils/capability-detector');
      const capabilities = detector.detect();

      expect(capabilities).toHaveProperty('webgpu');
    });

    test('Then: si WebGPU disponible, habilita ONNX WebGPU', () => {
      const detector = { webgpu: true };
      const registry = new RuntimeRegistry();

      registry.updateAvailability(detector);

      expect(registry.isAvailable('onnx-webgpu')).toBe(true);
    });

    test('And: si WebGPU NO disponible, deshabilita ONNX WebGPU', () => {
      const detector = { webgpu: false };
      const registry = new RuntimeRegistry();

      registry.updateAvailability(detector);

      expect(registry.isAvailable('onnx-webgpu')).toBe(false);
    });

    test('And: muestra tooltip "Tu navegador no soporta WebGPU"', () => {
      const registry = new RuntimeRegistry();
      registry.markUnavailable('onnx-webgpu', 'Tu navegador no soporta WebGPU');

      const runtime = registry.getRuntimeInfo('onnx-webgpu');
      expect(runtime.unavailableReason).toBe('Tu navegador no soporta WebGPU');
    });

    test('And: selecciona ONNX CPU como default', () => {
      const manager = new RuntimeManager();

      // Simular que WebGPU no está disponible
      manager.detectCapabilities({ webgpu: false });

      const defaultRuntime = manager.getDefaultRuntime();
      expect(defaultRuntime).toBe('onnx-cpu');
    });
  });

  describe('Escenario: Detección de endpoint local', () => {
    test('Given: usuario abre la app When: verifica endpoints locales', async () => {
      const detector = require('../../public/js/utils/endpoint-detector');

      // Mock: Ollama detectado
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      );

      const detected = await detector.scanLocalEndpoints();

      expect(detected).toContainEqual(
        expect.objectContaining({ type: 'ollama', url: 'http://localhost:11434' })
      );
    });

    test('Then: muestra notificación "Ollama detectado. ¿Usar como backend?"', async () => {
      const detector = require('../../public/js/utils/endpoint-detector');

      jest.spyOn(detector, 'scanLocalEndpoints').mockResolvedValue([
        { type: 'ollama', url: 'http://localhost:11434' }
      ]);

      const notification = await detector.getDetectionNotification();

      expect(notification.title).toContain('Ollama detectado');
      expect(notification.message).toContain('¿Usar como backend?');
    });

    test('And: al aceptar, configura automáticamente', async () => {
      const manager = new RuntimeManager();

      await manager.autoConfigureEndpoint('ollama', 'http://localhost:11434');

      expect(manager.getCurrentRuntimeId()).toBe('custom-endpoint');
      expect(manager.getCurrentRuntimeConfig().url).toBe('http://localhost:11434');
    });
  });
});

describe('Feature: Manejo de Errores y Recuperación', () => {

  describe('Escenario: Timeout en endpoint local', () => {
    test('Given: runtime actual es Endpoint Local', () => {
      const runtime = new EndpointRuntime();
      runtime.configure({ url: 'http://localhost:11434', modelName: 'test' });

      expect(runtime.getId()).toBe('custom-endpoint');
    });

    test('When: petición tarda más de 30 segundos Then: cancela petición', async () => {
      const runtime = new EndpointRuntime();
      runtime.configure({ url: 'http://localhost:11434', modelName: 'test' });

      // Mock fetch que nunca responde
      global.fetch = jest.fn(() => new Promise(() => {})); // Never resolves

      const timeoutMs = 100; // Usar 100ms para test rápido

      await expect(runtime.generateWithTimeout('test', timeoutMs))
        .rejects.toThrow('Timeout');
    });

    test('Then: muestra error "El endpoint no responde. Verifica que esté activo."', async () => {
      const runtime = new EndpointRuntime();

      try {
        await runtime.generateWithTimeout('test', 100);
      } catch (error) {
        expect(error.message).toContain('El endpoint no responde');
        expect(error.userMessage).toContain('Verifica que esté activo');
      }
    });

    test('And: ofrece botones "Reintentar" o "Cambiar a runtime local"', () => {
      const manager = new RuntimeManager();
      manager.setError('TIMEOUT');

      const options = manager.getErrorRecoveryOptions();

      expect(options).toContainEqual(
        expect.objectContaining({ id: 'retry', label: 'Reintentar' })
      );
      expect(options).toContainEqual(
        expect.objectContaining({ id: 'switch', label: 'Cambiar a runtime local' })
      );
    });
  });

  describe('Escenario: Error de CORS en endpoint', () => {
    test('Given: usuario configuró endpoint remoto', () => {
      const runtime = new EndpointRuntime();
      runtime.configure({ url: 'http://remote-server:11434', modelName: 'test' });
    });

    test('When: ocurre error de CORS Then: detecta como CORS', async () => {
      const runtime = new EndpointRuntime();

      // Simular error de CORS
      const corsError = new TypeError('Failed to fetch');

      expect(runtime.isCORSError(corsError)).toBe(true);
    });

    test('Then: muestra mensaje "Error de CORS. El servidor debe permitir requests desde este origen."', async () => {
      const runtime = new EndpointRuntime();

      const error = new TypeError('Failed to fetch');
      const userMessage = runtime.getUserFriendlyError(error);

      expect(userMessage).toContain('Error de CORS');
      expect(userMessage).toContain('debe permitir requests desde este origen');
    });

    test('And: muestra enlace a documentación de configuración CORS', () => {
      const runtime = new EndpointRuntime();

      const helpInfo = runtime.getCORSHelpInfo();

      expect(helpInfo).toHaveProperty('documentationUrl');
      expect(helpInfo.documentationUrl).toContain('cors');
    });
  });
});

describe('Feature: Métricas y Transparencia', () => {

  describe('Escenario: Mostrar información del runtime', () => {
    test('Given: usuario está en Settings When: navega a sección "Runtime"', () => {
      const manager = new RuntimeManager();
      const settings = manager.getSettings();

      expect(settings).toHaveProperty('runtime');
    });

    test('Then: muestra runtime actual con versión', () => {
      const runtime = new OnnxRuntime();
      const info = runtime.getInfo();

      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('version');
    });

    test('And: muestra tiempo de carga del modelo', () => {
      const runtime = new OnnxRuntime();

      // Simular carga
      runtime.loadTime = 2300; // ms

      const metrics = runtime.getMetrics();
      expect(metrics).toHaveProperty('loadTime', 2300);
    });

    test('And: muestra memoria utilizada', () => {
      const runtime = new OnnxRuntime();
      const metrics = runtime.getMetrics();

      expect(metrics).toHaveProperty('memoryUsed');
    });

    test('And: botón "Diagnostics" para verificar salud del runtime', () => {
      const manager = new RuntimeManager();

      const hasDiagnostics = typeof manager.runDiagnostics === 'function';
      expect(hasDiagnostics).toBe(true);
    });
  });
});

describe('Feature: Compatibilidad con Modelos', () => {

  describe('Escenario: Runtime soporta modelo seleccionado', () => {
    test('Given: usuario selecciona "Gemma 4 E2B" And: runtime es ONNX WebGPU', () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('onnx-webgpu');

      const modelId = 'gemma-4-e2b';
      const runtime = manager.getCurrentRuntime();

      expect(runtime.supportsModel(modelId)).toBe(true);
    });

    test('When: verifica compatibilidad Then: confirma que es compatible', () => {
      const checker = require('../../public/js/utils/compatibility-checker');

      const result = checker.check('gemma-4-e2b', 'onnx-webgpu');

      expect(result.compatible).toBe(true);
    });

    test('Then: permite la carga', async () => {
      const manager = new RuntimeManager();

      const canLoad = await manager.canLoadModel('gemma-4-e2b');
      expect(canLoad).toBe(true);
    });
  });

  describe('Escenario: Runtime NO soporta modelo', () => {
    test('Given: usuario selecciona "Llama 3.2 GGUF" And: runtime es ONNX WebGPU', () => {
      const manager = new RuntimeManager();
      manager.selectRuntime('onnx-webgpu');

      // ONNX WebGPU no soporta GGUF
      const runtime = manager.getCurrentRuntime();
      expect(runtime.supportsModel('llama-3.2-gguf')).toBe(false);
    });

    test('When: verifica compatibilidad Then: detecta incompatibilidad', () => {
      const checker = require('../../public/js/utils/compatibility-checker');

      const result = checker.check('llama-3.2-gguf', 'onnx-webgpu');

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('GGUF');
    });

    test('Then: muestra mensaje "Este modelo requiere runtime GGUF"', () => {
      const checker = require('../../public/js/utils/compatibility-checker');

      const result = checker.check('llama-3.2-gguf', 'onnx-webgpu');

      expect(result.message).toContain('requiere runtime GGUF');
    });

    test('And: ofrece cambio automático al runtime adecuado', () => {
      const checker = require('../../public/js/utils/compatibility-checker');

      const result = checker.check('llama-3.2-gguf', 'onnx-webgpu');

      expect(result.suggestedRuntime).toBe('gguf');
    });
  });
});
