# Gemma 4 Chat - Local Model Support

Aplicación de chat con Gemma 4 E2B (QAT Mobile) con soporte para ejecutar el modelo **localmente** sin necesidad de descargarlo cada vez.

## Características

- ✅ **Interfaz tipo ChatGPT** - Diseño limpio y profesional
- ✅ **Markdown rendering** - Código, tablas, listas, etc.
- ✅ **Persistencia de chats** - Guarda historial en localStorage
- ✅ **Soporte modelo local** - Descarga una vez, usa siempre
- ✅ **Detección automática** - Usa local si existe, CDN si no

## Requisitos

- Node.js 18+
- Chrome/Edge 113+ (WebGPU)
- ~2.5 GB de espacio libre (para el modelo)

## Instalación Rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Descargar el modelo (~2.3GB, solo una vez)
npm run download

# 3. Iniciar servidor
npm start
```

Abre http://localhost:3000 en tu navegador.

## Flujo de Uso

### Primera vez:
1. Ejecutas `npm run download` → Descarga el modelo a `./model/`
2. Ejecutas `npm start` → Inicia el servidor
3. Abres http://localhost:3000 → El modelo se carga desde local

### Veces siguientes:
1. Ejecutas `npm start`
2. La app detecta automáticamente el modelo local
3. Carga instantáneamente desde disco

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia el servidor web |
| `npm run download` | Descarga el modelo (2.3GB) |
| `npm run dev` | Alias de `npm start` |

## Estructura

```
webml-webpage/
├── index.html          # App principal
├── server.js           # Servidor Express
├── download-model.js   # Script de descarga
├── package.json
├── model/              # Modelo descargado (2.3GB)
│   ├── model.safetensors
│   ├── tokenizer.json
│   └── ...
└── README.md
```

## Cómo funciona

### Detección de modelo local

El servidor proporciona un endpoint `/api/model-status` que verifica si los archivos del modelo existen en `./model/`.

La app consulta este endpoint al cargar:
- Si existe → Usa el servidor local (rápido, offline)
- Si no existe → Ofrece descargar o usa CDN (lento, requiere internet)

### Descarga del modelo

El script `download-model.js` descarga los siguientes archivos desde HuggingFace:

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `model.safetensors` | ~2.3 GB | Pesos del modelo |
| `tokenizer.json` | ~32 MB | Tokenizador |
| `config.json` | ~6 KB | Configuración |
| `*.json` | ~1 KB | Configs adicionales |

Total: ~2.5 GB

### Caché del navegador

El modelo también se cachea en el navegador usando Cache API después de la primera carga. Esto significa que incluso sin el servidor local, las cargas siguientes serán más rápidas.

## Solución de problemas

### "Modelo no encontrado"
- Verifica que ejecutaste `npm run download`
- Comprueba que existe la carpeta `./model/`
- Revisa que el archivo `model.safetensors` tenga ~2.3GB

### "WebGPU no soportado"
- Usa Chrome 113+ o Edge 113+
- Verifica que tu GPU soporte WebGPU
- En Linux, puede necesitar flags: `--enable-features=Vulkan`

### Error de descarga
- Verifica tu conexión a internet
- Asegúrate de tener espacio libre suficiente
- El modelo se descarga desde HuggingFace (requiere internet)

## Notas técnicas

- El modelo `Gemma4Mobile` viene del CDN de HuggingFace (`gemma-4-e2b.js`)
- El servidor actúa como proxy para los archivos del modelo
- Los pesos se cargan vía `fetch()` interceptado por el Service Worker (si está activo) o directamente desde el servidor local
- El bundle de `gemma-4-e2b.js` maneja internamente la carga de tensores

## Licencia

Este proyecto es para uso personal. El modelo Gemma 4 tiene licencia Apache 2.0 de Google.
