# vue-image-parser

[![npm version](https://img.shields.io/npm/v/vue-image-parser.svg)](https://www.npmjs.com/package/vue-image-parser)
[![CI](https://github.com/mayur19/vue-image-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/mayur19/vue-image-parser/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Universal image rendering engine for Vue 3 — supports JPEG, PNG, WebP, GIF, HEIC, and AVIF with WASM fallback and zero main-thread blocking.

## Features

- **Format Detection** — Binary signature detection (never file extensions) for JPEG, PNG, WebP, GIF, HEIC, HEIF, AVIF
- **Capability Probing** — Pixel-verified native decode testing to determine browser support
- **WASM Fallback** — Automatic fallback to libheif-js for HEIC/AVIF on unsupported browsers
- **Web Worker Decoding** — Decode off the main thread via a pre-spawned worker pool
- **EXIF Auto-Orient** — Automatic JPEG EXIF orientation handling
- **GPU Rendering** — Uses ImageBitmap + drawImage for GPU-accelerated canvas rendering
- **Vue 3 Integration** — `useImage` composable and `<UniversalImage>` component
- **SSR Safe** — All browser APIs guarded for Nuxt/SSR environments
- **Tree-Shakable** — ESM-only with `sideEffects: false`

## Installation

```bash
npm install vue-image-parser
```

HEIC/AVIF support via libheif-js is included out of the box.

## Quick Start

### Composable

```vue
<script setup>
import { useImage } from 'vue-image-parser'

const { image, loading, error } = useImage('/photos/example.heic')
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">{{ error.message }}</div>
  <canvas v-else ref="canvas" />
</template>
```

### Component

```vue
<script setup>
import { UniversalImage } from 'vue-image-parser'
</script>

<template>
  <UniversalImage src="/photos/example.avif" :max-dimension="1024" />
</template>
```

### Plugin (global registration)

```ts
import { createApp } from 'vue'
import { ImageParserPlugin } from 'vue-image-parser'

const app = createApp(App)
app.use(ImageParserPlugin)
```

### Programmatic API

```ts
import { loadImage, renderImage, detectFormat, disposeEngine } from 'vue-image-parser'

// Load and decode
const decoded = await loadImage('/photo.heic', {
  strategy: 'auto',    // 'auto' | 'native' | 'wasm'
  maxDimension: 2048,
  timeout: 30000,
})

// Render to canvas
const canvas = document.getElementById('canvas') as HTMLCanvasElement
renderImage(canvas, decoded, { fit: 'contain' })

// Detect format without decoding
const format = detectFormat(buffer)

// Clean up when done
decoded.dispose()
disposeEngine()
```

## API Reference

### Core Functions

| Function | Description |
|----------|-------------|
| `loadImage(source, options?)` | Load and decode an image from URL, File, Blob, or ArrayBuffer |
| `renderImage(target, image, options?)` | Render a decoded image onto a canvas or HTML element |
| `detectFormat(buffer)` | Detect image format from binary signature |
| `detectFormatFromBlob(blob)` | Detect format from a Blob (reads first 64 bytes) |
| `warmup(formats)` | Pre-initialize WASM codecs for given formats |
| `disposeEngine()` | Release all resources (worker pool, codecs, registries) |

### LoadOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strategy` | `'auto' \| 'native' \| 'wasm'` | `'auto'` | Decoding strategy |
| `signal` | `AbortSignal` | — | Cancellation signal |
| `timeout` | `number` | `30000` | Timeout in milliseconds |
| `maxDimension` | `number` | — | Max width/height for downsampling |
| `maxFileSize` | `number` | `104857600` | Max file size in bytes (100 MB) |
| `autoOrient` | `boolean` | `true` | Auto-orient based on EXIF |
| `onProgress` | `(p: number) => void` | — | Progress callback (0.0-1.0) |

### RenderOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fit` | `'contain' \| 'cover' \| 'fill' \| 'none' \| 'scale-down'` | `'contain'` | Object-fit behavior |
| `width` | `number` | image width | Target width |
| `height` | `number` | image height | Target height |
| `background` | `string` | — | Background color for letterboxing |
| `dpr` | `number` | `devicePixelRatio` | Device pixel ratio |

### Utilities

| Function | Description |
|----------|-------------|
| `toDataURL(image, mimeType?)` | Convert decoded image to data URL |
| `toBlobURL(image, mimeType?)` | Convert decoded image to blob URL |
| `toImageBitmap(image)` | Convert decoded image to ImageBitmap |

### Error Types

All errors extend `ImageParserError` with a machine-readable `code`:

| Error | Code(s) | When |
|-------|---------|------|
| `FormatDetectionError` | `FORMAT_DETECTION_FAILED` | Unrecognized binary signature |
| `CodecError` | `DECODE_FAILED`, `HEIC_DECODE_FAILED`, `AVIF_DECODE_FAILED` | Decode failure |
| `FetchError` | `FETCH_FAILED`, `FILE_TOO_LARGE` | Network or file size error |
| `TimeoutError` | `FETCH_TIMEOUT` | Operation exceeded timeout |
| `AbortError` | `ABORTED` | Cancelled via AbortSignal |
| `WorkerError` | `WORKER_CRASHED` | Web Worker failure |

## Supported Formats

| Format | Native | WASM Fallback |
|--------|--------|---------------|
| JPEG | All browsers | — |
| PNG | All browsers | — |
| GIF | All browsers | — |
| WebP | All modern browsers | — |
| HEIC/HEIF | Safari 17+ | libheif-js |
| AVIF | Chrome 85+, Firefox 93+ | libheif-js |

## Browser Compatibility

- Chrome 85+
- Firefox 93+
- Safari 16.4+ (OffscreenCanvas)
- Edge 85+

Older browsers work with reduced functionality (main-thread decoding, no OffscreenCanvas).

## Memory Management

Decoded images hold GPU resources (ImageBitmaps) and pixel buffers. Always dispose them when done:

```ts
const decoded = await loadImage('/photo.heic')
try {
  renderImage(canvas, decoded)
} finally {
  decoded.dispose()
}
```

In long-lived apps (SPAs), call `disposeEngine()` when your image-handling view is torn down to release the worker pool and codec instances:

```ts
import { onBeforeUnmount } from 'vue'
import { disposeEngine } from 'vue-image-parser'

onBeforeUnmount(() => {
  disposeEngine()
})
```

The `useImage()` composable handles disposal automatically on component unmount.

## Error Handling

All errors extend `ImageParserError` with a machine-readable `code` for programmatic handling:

```ts
import { loadImage, ImageParserError, ErrorCodes } from 'vue-image-parser'

try {
  const decoded = await loadImage(url)
} catch (error) {
  if (error instanceof ImageParserError) {
    switch (error.code) {
      case ErrorCodes.FORMAT_DETECTION_FAILED:
        console.warn('Unsupported image format')
        break
      case ErrorCodes.FETCH_TIMEOUT:
        console.warn('Image took too long to load')
        break
      case ErrorCodes.FILE_TOO_LARGE:
        console.warn('Image exceeds size limit')
        break
      default:
        console.error('Image error:', error.message)
    }
  }
}
```

## SSR / Nuxt

All browser APIs are guarded behind `isBrowser()` checks. Use `onMounted()` or `<ClientOnly>` to defer image operations:

```vue
<script setup>
import { onMounted } from 'vue'
import { loadImage } from 'vue-image-parser'

onMounted(async () => {
  const decoded = await loadImage('/photo.heic')
  // ...
})
</script>
```

## Contributing

Contributions are welcome! Please read the [Contributing Guide](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before submitting a PR.

## License

[MIT](./LICENSE)
