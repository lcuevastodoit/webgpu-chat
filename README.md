# Gemma 4 Chat - Local Model Support

A chat application with Gemma 4 E2B (QAT Mobile) supporting local model execution without downloading it every time.

Una aplicación de chat con Gemma 4 E2B (QAT Mobile) con soporte para ejecutar el modelo **localmente** sin necesidad de descargarlo cada vez.

---

## 🚀 Quick Start / Inicio Rápido

### Docker (Recommended / Recomendado)

```bash
# Start container / Iniciar contenedor
docker compose up -d

# Or use aliases / O usa los alias:
# webml-start    → Start
# webml-restart  → Restart  
# webml-stop     → Stop
# webml-logs     → View logs
```

Access at / Accede en: **http://localhost:8082**

### Manual / Manualmente

```bash
# Install dependencies / Instalar dependencias
npm install

# Download model (~2.3GB, only once / solo una vez)
npm run download

# Start server / Iniciar servidor
npm start
```

Access at / Accede en: **http://localhost:3000**

---

## ✨ Features / Características

| English | Español |
|---------|---------|
| **ChatGPT-like interface** - Clean and professional design | **Interfaz tipo ChatGPT** - Diseño limpio y profesional |
| **Markdown rendering** - Code, tables, lists, etc. | **Markdown rendering** - Código, tablas, listas, etc. |
| **Chat persistence** - Saves history in localStorage | **Persistencia de chats** - Guarda historial en localStorage |
| **Local model support** - Download once, use forever | **Soporte modelo local** - Descarga una vez, usa siempre |
| **Auto detection** - Uses local if exists, CDN if not | **Detección automática** - Usa local si existe, CDN si no |
| **Docker support** - Easy restart with container | **Soporte Docker** - Reinicio fácil con contenedor |

---

## 📋 Requirements / Requisitos

- Node.js 18+ (for manual install / para instalación manual)
- Docker & Docker Compose (for Docker / para Docker)
- Chrome/Edge 113+ (WebGPU required / requerido)
- ~2.5 GB free space (for model / para el modelo)

---

## 🐳 Docker Usage / Uso con Docker

### Available Commands / Comandos Disponibles

Add to `~/.bash_profile` / Agregar a `~/.bash_profile`:

```bash
# WebML Docker aliases
alias webml-restart='cd /path/to/webml-webpage && docker compose restart && echo "WebML running at http://localhost:8082"'
alias webml-logs='cd /path/to/webml-webpage && docker compose logs -f'
alias webml-stop='cd /path/to/webml-webpage && docker compose down'
alias webml-start='cd /path/to/webml-webpage && docker compose up -d'
```

Then reload / Luego recarga:
```bash
source ~/.bash_profile
```

### Why Docker? / ¿Por qué Docker?

| English | Español |
|---------|---------|
- Easy restart: just run `webml-restart` | Reinicio fácil: solo ejecuta `webml-restart` |
- Port 8082 exposed and ready | Puerto 8082 expuesto y listo |
- Model files persist between restarts | Archivos del modelo persisten entre reinicios |
- No need to remember commands | No necesitas recordar comandos |

---

## 🔄 Usage Flow / Flujo de Uso

### First Time / Primera vez:

1. **Docker:** `docker compose up -d --build`
   - **Manual:** `npm install && npm run download`
2. Access / Accede http://localhost:8082 (Docker) or / o http://localhost:3000 (Manual)
3. Model loads from local server / El modelo carga desde el servidor local

### Subsequent Times / Veces siguientes:

1. **Docker:** `docker compose restart` or / o `webml-restart`
   - **Manual:** `npm start`
2. App auto-detects local model / La app detecta automáticamente el modelo local
3. Loads instantly from disk / Carga instantáneamente desde disco

---

## 📁 Project Structure / Estructura del Proyecto

```
webml-webpage/
├── docker-compose.yml     # Docker configuration / Configuración Docker
├── Dockerfile             # Docker image / Imagen Docker
├── server.js              # Express server / Servidor Express
├── package.json
├── download-model.js      # Download script / Script de descarga
├── model/                 # Downloaded model (2.3GB) / Modelo descargado
│   ├── model.safetensors  # Weights (~2.3GB) / Pesos
│   ├── tokenizer.json     # Tokenizer (~31MB) / Tokenizador
│   ├── chat_template.jinja
│   └── *.json             # Configs / Configuraciones
├── public/
│   └── js/
│       └── model.js       # Loads from local / Carga desde local
└── README.md
```

---

## 🔧 How It Works / Cómo Funciona

### Local Model Detection / Detección de Modelo Local

The server provides an endpoint `/api/model-status` that checks if model files exist in `./model/`.

El servidor proporciona un endpoint `/api/model-status` que verifica si los archivos del modelo existen en `./model/`.

The app queries this endpoint on load:
- **If exists** → Uses local server (fast, offline / rápido, offline)
- **If not** → Offers to download or uses CDN (slow, requires internet / lento, requiere internet)

La app consulta este endpoint al cargar:
- **Si existe** → Usa el servidor local (rápido, offline)
- **Si no** → Ofrece descargar o usa CDN (lento, requiere internet)

### Model Download / Descarga del Modelo

The script `download-model.js` downloads these files from HuggingFace:

El script `download-model.js` descarga estos archivos desde HuggingFace:

| File / Archivo | Size / Tamaño | Description / Descripción |
|----------------|---------------|---------------------------|
| `model.safetensors` | ~2.3 GB | Model weights / Pesos del modelo |
| `tokenizer.json` | ~32 MB | Tokenizer / Tokenizador |
| `chat_template.jinja` | ~17 KB | Chat template / Plantilla de chat |
| `config.json` | ~6 KB | Configuration / Configuración |
| `*.json` | ~1 KB | Additional configs / Configs adicionales |

**Total: ~2.5 GB**

### Local Loading / Carga Local

The key change in `public/js/model.js`:

El cambio clave en `public/js/model.js`:

```javascript
// Before / Antes (from CDN / desde CDN):
this.model = await Gemma4Mobile.load(null, { onProgress });

// After / Después (from local server / desde servidor local):
const localModelUrl = `${window.location.origin}/model`;
this.model = await Gemma4Mobile.load(localModelUrl, { onProgress });
```

---

## 🛠️ Available Scripts / Scripts Disponibles

| Command / Comando | Description / Descripción |
|-------------------|---------------------------|
| `npm start` | Start web server / Inicia el servidor web |
| `npm run download` | Download model (2.3GB) / Descarga el modelo |
| `npm run dev` | Alias of `npm start` / Alias de `npm start` |
| `docker compose up -d` | Start container / Inicia el contenedor |
| `docker compose restart` | Restart container / Reinicia el contenedor |
| `docker compose down` | Stop container / Detiene el contenedor |
| `docker compose logs -f` | View logs / Ver logs |

---

## 🐛 Troubleshooting / Solución de Problemas

### "Model not found" / "Modelo no encontrado"
- **EN:** Verify you ran `npm run download` or the model files exist in `./model/`
- **ES:** Verifica que ejecutaste `npm run download` o que los archivos del modelo existan en `./model/`
- Check `model.safetensors` is ~2.3GB / Revisa que `model.safetensors` tenga ~2.3GB

### "WebGPU not supported" / "WebGPU no soportado"
- Use Chrome 113+ or Edge 113+ / Usa Chrome 113+ o Edge 113+
- Check GPU supports WebGPU / Verifica que tu GPU soporte WebGPU
- Linux may need flags / En Linux, puede necesitar flags: `--enable-features=Vulkan`

### Download error / Error de descarga
- Check internet connection / Verifica tu conexión a internet
- Ensure enough free space / Asegúrate de tener espacio libre suficiente
- Model downloads from HuggingFace (requires internet) / El modelo se descarga desde HuggingFace (requiere internet)

### Docker issues / Problemas con Docker
- **Port in use / Puerto en uso:** Change port in `docker-compose.yml` / Cambia el puerto en `docker-compose.yml`
- **Permission denied / Permiso denegado:** Try with `sudo` / Prueba con `sudo`

---

## 📝 Technical Notes / Notas Técnicas

- The `Gemma4Mobile` model comes from HuggingFace CDN (`gemma-4-e2b.js`)
- The server acts as a proxy for model files
- Weights load via `fetch()` from local server
- The `gemma-4-e2b.js` bundle handles internal tensor loading
- Model files persist in Docker volume between restarts

- El modelo `Gemma4Mobile` viene del CDN de HuggingFace (`gemma-4-e2b.js`)
- El servidor actúa como proxy para los archivos del modelo
- Los pesos se cargan vía `fetch()` desde el servidor local
- El bundle de `gemma-4-e2b.js` maneja internamente la carga de tensores
- Los archivos del modelo persisten en el volumen Docker entre reinicios

---

## 📄 License / Licencia

This project is for personal use. The Gemma 4 model has Apache 2.0 license from Google.

Este proyecto es para uso personal. El modelo Gemma 4 tiene licencia Apache 2.0 de Google.

---

## 🔗 Links / Enlaces

- **Model / Modelo:** https://huggingface.co/google/gemma-4-E2B-it-qat-mobile-transformers
- **WebGPU Kernels:** https://huggingface.co/spaces/webml-community/gemma-4-webgpu-kernels
