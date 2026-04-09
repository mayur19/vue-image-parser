# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-04-06

### Added

- Core image loading pipeline with `loadImage()` supporting URL, File, Blob, and ArrayBuffer sources
- Binary signature-based format detection for JPEG, PNG, GIF, WebP, HEIC, HEIF, AVIF
- ISOBMFF ftyp box parser for distinguishing HEIC/HEIF/AVIF containers
- Pixel-verified capability probing via `CapabilityRegistry` with IndexedDB persistence
- Native browser codec using `createImageBitmap` with lazy RGBA readback
- HEIC WASM codec via libheif-js with dynamic lazy loading
- AVIF WASM codec via libheif-js with dynamic lazy loading
- Pre-spawned Web Worker pool with priority task queue for off-main-thread decoding
- Zero-copy ArrayBuffer transfers between workers and main thread
- EXIF orientation reading and auto-correction for JPEG images
- Canvas2D rendering with object-fit modes (contain, cover, fill, none, scale-down)
- GPU-accelerated rendering via ImageBitmap when available
- `toDataURL()`, `toBlobURL()`, and `toImageBitmap()` conversion utilities
- Vue 3 `useImage` composable with reactive loading state
- `<UniversalImage>` Vue component
- `ImageParserPlugin` for global Vue registration
- Full `AbortSignal` support throughout the pipeline
- SSR safety guards for Nuxt/server-side rendering
- Comprehensive error hierarchy with machine-readable error codes

### Security

- File size validation with configurable `maxFileSize` option (default: 100 MB)
- Dimension validation in WASM codecs to prevent OOM from malicious images
- URL protocol validation (rejects `javascript:` and non-HTTP(S) URLs)
- Safe DOM manipulation (no `innerHTML` usage)
