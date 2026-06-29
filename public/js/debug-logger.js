// Debug logger - muestra logs en pantalla
(function() {
  const logs = [];

  function showLogs() {
    let div = document.getElementById('debug-logger');
    if (!div) {
      div = document.createElement('div');
      div.id = 'debug-logger';
      div.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 600px;
        height: 300px;
        background: rgba(0,0,0,0.9);
        color: #0f0;
        font-family: monospace;
        font-size: 11px;
        padding: 10px;
        overflow-y: auto;
        z-index: 9999;
        border: 1px solid #0f0;
      `;
      document.body.appendChild(div);

      const close = document.createElement('button');
      close.textContent = 'X';
      close.style.cssText = 'position:absolute;top:5px;right:5px;background:#f00;color:#fff;border:none;cursor:pointer;';
      close.onclick = () => div.remove();
      div.appendChild(close);
    }
    div.innerHTML = '<button style="position:absolute;top:5px;right:5px;background:#f00;color:#fff;border:none;">X</button>' +
      logs.slice(-20).join('<br>');
  }

  const origLog = console.log;
  console.log = function(...args) {
    logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    origLog.apply(console, args);
    if (logs.length > 100) logs.shift();
  };

  window.showDebugLogs = showLogs;

  // Auto-show on error
  window.addEventListener('error', showLogs);
})();
