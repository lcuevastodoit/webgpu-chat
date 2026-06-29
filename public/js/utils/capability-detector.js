function detect() {
  const capabilities = {
    webgpu: typeof navigator !== 'undefined' && navigator.gpu !== undefined,
    webgl: typeof navigator !== 'undefined' && navigator.gpu !== undefined,
    wasm: typeof WebAssembly !== 'undefined',
    workers: typeof Worker !== 'undefined'
  };
  return capabilities;
}

module.exports = { detect };
