# vue-image-parser 🖼️⚡️

> A hyper-optimized, universal, WASM-accelerated image rendering engine for Vue 3.

`vue-image-parser` is a production-grade library designed to effortlessly handle and render modern, next-generation image formats (like **HEIC** and **AVIF**) alongside standard formats (JPEG, PNG, WebP) in any browser. It was built specifically to solve the massive performance and compatibility headaches that come with building next-generation web platforms.

---

## 🚀 Why use `vue-image-parser` over others?

Most existing image parsers or Vue wrapper libraries suffer from naive detection and main-thread blocking. Here is how `vue-image-parser` is architected for maximum performance:

### 1. Pixel-Verified Native Routing (Zero False Positives)
Usually, formats are tested by injecting an `<img>` tag into the DOM and waiting for the `onload` event. This is dangerously flawed: many browsers (especially WebViews) will fire `onload` but render an empty `0x0` transparent box or a broken layout. 
**Our engine runs actual 2x2 byte-level pixel probes via `createImageBitmap` and reads the Canvas output byte-by-byte**. If the colors don't match exactly, we know the browser natively failed, and we automatically fallback to our internal WASM decode engine. Probe results are heavily cached via `IndexedDB` with browser fingerprinting so it only checks once per device.

### 2. Off-Main-Thread Execution (Jank-Free)
Heavy tasks like decoding HEIC or AVIF binaries using WASM traditionally block the main UI thread, causing CSS animations to stutter and tabs to freeze. 
**We pushed everything to Web Workers.** Decoding requests are placed into a tunable, priority-based `TaskQueue` monitored by a `WorkerPool`. Your UI never locks up, no matter how massive the image is.

### 3. Zero-Copy Memory Management
Javascript memory management can be brutal when handling raw RGBA binary data. If an 8K image is parsed, serializing it back to the main thread via JSON/Cloning destroys RAM. 
Our workers use **Zero-copy ArrayBuffer Transfers**. Web Worker results are instantly transferred to the main thread via memory-ownership swapping, avoiding the memory duplication that plagues older libraries.

### 4. Lazy-Loaded WASM
WASM binaries are huge. `libheif-js` and AVIF libraries can add MBs to your bundle. 
**We dynamically lazy-load WASM binaries only if required**. If a user on Safari visits your site, Safari natively decodes HEIC. The user downloads 0 bytes of WASM. If a user on Chrome visits with a HEIC, we fallback and dynamically fetch the WASM chunk in the background via the worker. This keeps the core bundle microscopic.

### 5. Smart Object Fitting & Auto-Orientation 
Exif data parsing is built directly into the parsing layer, meaning your iPhone vertical shots won't show up entirely sideways. Plus, the `<UniversalImage />` component leverages native `<canvas>` hardware-accelerated drawing combined with CSS-like `object-fit: cover` and `contain` fallbacks for when native `<image>` URLs fail.

---

## 📦 Installation

```bash
npm install vue-image-parser
```
*(Peer dependency: `vue@^3.0.0`)*

---

## 🛠️ Getting Started

### 1. Plugin Registration
Register the plugin globally to get access to `<UniversalImage />` everywhere.

```typescript
import { createApp } from 'vue';
import App from './App.vue';
import { ImageParserPlugin } from 'vue-image-parser';

const app = createApp(App);
app.use(ImageParserPlugin);
app.mount('#app');
```

---

### 2. Declarative Usage (`UniversalImage`)
The simplest way to use the library is via the `UniversalImage` component. It behaves exactly like an `<img>` tag, but works cleanly with HEIC, AVIF, and guarantees loading/error states.

```html
<template>
  <!-- Renders seamlessly on all browsers! -->
  <UniversalImage 
    src="https://example.com/high-res-photo.heic" 
    alt="A stunning sunset"
    width="400"
    height="300"
    fit="cover"
    background="#e0e0e0"
    lazy
  />
</template>
```

#### **Props:**
* `src`: The source of the image (`File`, `Blob`, `ArrayBuffer`, or `URL string`).
* `lazy`: Set to `true` to utilize an internal `IntersectionObserver`. Images will not decode, load, or fetch WASM until they are scrolled into view.
* `fit`: Controls internal canvas rendering (`cover`, `contain`, `fill`, etc).
* `fallbackSrc`: Provides a fallback static URL if decoding completely throws.

---

### 3. Programmatic Usage (`useImage`)
For complete reactivity and control (for example, reading metadata or tracking progress), utilize the `useImage` composable!

```html
<script setup>
import { useImage } from 'vue-image-parser';

const fileInput = ref(null);
const selectedFile = ref(null);

// Automatically decodes whenever selectedFile changes
const { loading, decoded, error, format } = useImage(selectedFile);

function onFileSelect(event) {
  selectedFile.value = event.target.files[0];
}
</script>

<template>
  <input type="file" @change="onFileSelect" />

  <div v-if="loading">Processing image on the background thread...</div>
  
  <div v-else-if="error">
    Failed to decode: {{ error.message }}
  </div>

  <div v-else-if="decoded">
    <p>Format detected: {{ format }}</p>
    <p>Resolution: {{ decoded.width }} x {{ decoded.height }}</p>
    <!-- Use UniversalImage by feeding it the raw file, or extract base64 -->
  </div>
</template>
```

---

## ⚖️ Performance Tips for Production

If you are rendering massive galleries (50+ formats at once), follow these rules:
1. **Always use `lazy`**: `<UniversalImage lazy />` leverages IntersectionObservers so memory pools don't stall fetching off-screen WASM tasks.
2. **Limit Max Dimensions**: By default, full scale decoded images live in RAM. To heavily preserve performance, supply the `maxDimension` parameter when using the low-level Javascript `loadImage()` API to resize the array buffers natively instead of resizing gigantic buffers in vue reactivity logs.

## 🤝 Contributing / Architecture
Check the inner architecture within `/src`.
* `capability` - Evaluates the browser rendering specs using 2x2 binary probe arrays. 
* `codecs` - Contains logic for evaluating native browser components and falling back on tree-shakable `.wasm` wrappers.
* `workers` - Controls multi-threading logic to avoid blocking the user device UI.

## License
MIT
