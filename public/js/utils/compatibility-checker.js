function check(modelId, runtimeId) {
  const runtimeSupports = {
    'onnx-webgpu': ['gemma', 'onnx', 'qwen', 'bonsai'],
    'onnx-cpu': ['gemma', 'onnx', 'qwen', 'bonsai'],
    'custom-endpoint': ['*'] // Endpoint puede cargar cualquier cosa
  };

  const supportedModels = runtimeSupports[runtimeId] || [];
  const isCompatible = supportedModels.includes('*') ||
                       supportedModels.some(s => modelId.toLowerCase().includes(s));

  if (isCompatible) {
    return {
      compatible: true,
      message: 'Compatible'
    };
  }

  // Modelo no compatible
  const format = modelId.includes('gguf') ? 'GGUF' :
                 modelId.includes('safetensors') ? 'Safetensors' : 'desconocido';

  return {
    compatible: false,
    reason: `Este modelo usa formato ${format}`,
    message: `Este modelo requiere runtime ${format}`,
    suggestedRuntime: modelId.includes('gguf') ? 'gguf' : 'custom-endpoint'
  };
}

module.exports = { check };
