import { I as ImageFormat, U as UNIVERSALLY_SUPPORTED_FORMATS, C as CodecError, E as ErrorCodes, W as WorkerError, F as FetchError, a as ImageParserError, A as AbortError, T as TimeoutError, b as FormatDetectionError } from "./chunks/codes-Dq73-3CT.js";
import { ref, shallowRef, watch, toValue, onBeforeUnmount, readonly, shallowReadonly, defineComponent, computed, onMounted, openBlock, createElementBlock, normalizeStyle, unref, renderSlot, createElementVNode } from "vue";
const SIGNATURES = [
  {
    // JPEG: starts with FF D8 FF
    format: ImageFormat.JPEG,
    match: (buf) => buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255
  },
  {
    // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    format: ImageFormat.PNG,
    match: (buf) => buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10
  },
  {
    // GIF: starts with "GIF87a" or "GIF89a"
    format: ImageFormat.GIF,
    match: (buf) => buf.length >= 6 && buf[0] === 71 && buf[1] === 73 && buf[2] === 70 && buf[3] === 56 && (buf[4] === 55 || buf[4] === 57) && buf[5] === 97
  },
  {
    // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
    format: ImageFormat.WebP,
    match: (buf) => buf.length >= 12 && buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf[8] === 87 && buf[9] === 69 && buf[10] === 66 && buf[11] === 80
  }
  // HEIC/HEIF/AVIF are handled by ftyp parser — not matched here.
  // They share the ISOBMFF container and need brand-level parsing.
];
const MIN_DETECTION_BYTES = 64;
const AVIF_BRANDS = /* @__PURE__ */ new Set(["avif", "avis"]);
const HEIC_BRANDS = /* @__PURE__ */ new Set(["heic", "heix", "heim", "heis"]);
const HEIF_BRANDS = /* @__PURE__ */ new Set(["mif1", "msf1"]);
function hasFtypBox(buf) {
  return buf.length >= 12 && buf[4] === 102 && // f
  buf[5] === 116 && // t
  buf[6] === 121 && // y
  buf[7] === 112;
}
function readBrand(buf, offset) {
  if (offset + 4 > buf.length) return "";
  return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
}
function parseFtyp(buf) {
  if (!hasFtypBox(buf)) {
    return ImageFormat.Unknown;
  }
  const boxSize = buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3];
  const readableSize = Math.min(boxSize, buf.length);
  if (readableSize < 12) {
    return ImageFormat.Unknown;
  }
  const brands = /* @__PURE__ */ new Set();
  brands.add(readBrand(buf, 8));
  for (let offset = 16; offset + 4 <= readableSize; offset += 4) {
    const brand = readBrand(buf, offset);
    if (brand.length === 4) {
      brands.add(brand);
    }
  }
  for (const brand of brands) {
    if (AVIF_BRANDS.has(brand)) return ImageFormat.AVIF;
  }
  for (const brand of brands) {
    if (HEIC_BRANDS.has(brand)) return ImageFormat.HEIC;
  }
  for (const brand of brands) {
    if (HEIF_BRANDS.has(brand)) return ImageFormat.HEIF;
  }
  return ImageFormat.Unknown;
}
function couldBeFtyp(buf) {
  return hasFtypBox(buf);
}
function detectFormat(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, MIN_DETECTION_BYTES));
  if (bytes.length < 4) {
    return ImageFormat.Unknown;
  }
  for (const sig of SIGNATURES) {
    if (sig.match(bytes)) {
      return sig.format;
    }
  }
  if (couldBeFtyp(bytes)) {
    const ftypResult = parseFtyp(bytes);
    if (ftypResult !== ImageFormat.Unknown) {
      return ftypResult;
    }
  }
  return ImageFormat.Unknown;
}
async function detectFormatFromBlob(blob) {
  const slice = blob.slice(0, MIN_DETECTION_BYTES);
  const buffer = await slice.arrayBuffer();
  return detectFormat(buffer);
}
var FormatFeature = /* @__PURE__ */ ((FormatFeature2) => {
  FormatFeature2["BASE_DECODE"] = "base_decode";
  FormatFeature2["ALPHA"] = "alpha";
  FormatFeature2["ANIMATION"] = "animation";
  FormatFeature2["HIGH_BIT_DEPTH"] = "high_bit_depth";
  FormatFeature2["HDR"] = "hdr";
  FormatFeature2["GRID_TILING"] = "grid_tiling";
  return FormatFeature2;
})(FormatFeature || {});
var SupportLevel = /* @__PURE__ */ ((SupportLevel2) => {
  SupportLevel2["FULL_SUPPORT"] = "full_support";
  SupportLevel2["PARTIAL_SUPPORT"] = "partial_support";
  SupportLevel2["NO_SUPPORT"] = "no_support";
  SupportLevel2["UNKNOWN"] = "unknown";
  return SupportLevel2;
})(SupportLevel || {});
const WEBP_BASE_DECODE = {
  format: ImageFormat.WebP,
  feature: FormatFeature.BASE_DECODE,
  // 2x2 lossless WebP with RGBW pixels
  base64: "UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoCAAIAP/3+/3+/ureyMD/z6A/JiWAAzZL/AD4A/Ov9d/sXuKGBAAD++KK3EKajfxD/97fYjrMR1AZmH8Mh2oPNqAAAAA==",
  mimeType: "image/webp",
  expectedWidth: 2,
  expectedHeight: 2,
  expectedPixels: [
    { x: 0, y: 0, r: 255, g: 0, b: 0, a: 255 },
    // Top-left: Red
    { x: 1, y: 0, r: 0, g: 255, b: 0, a: 255 },
    // Top-right: Green
    { x: 0, y: 1, r: 0, g: 0, b: 255, a: 255 },
    // Bottom-left: Blue
    { x: 1, y: 1, r: 255, g: 255, b: 255, a: 255 }
    // Bottom-right: White
  ],
  tolerance: 5
};
const AVIF_BASE_DECODE = {
  format: ImageFormat.AVIF,
  feature: FormatFeature.BASE_DECODE,
  // Minimal 2x2 AVIF with RGBW pixels
  base64: "AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADtbWV0YQAAAAAAAABIaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAjYXZpQwAAAA1hdjAxgAAMABEACAAIAAQMEAAAAAAUaXBycAAAABNpcGNvAAAAFGlzcGUAAAAAAAACAAAAAgAAAA5hdXhDAAAAAHVybjptcGVnOmNpY3A6c3lzdGVtczoxAAAAHGNvbHJuY2x4AAIAAgACAAAADmF2MUMAAAALTGF2YzYxLjMuMTAw",
  mimeType: "image/avif",
  expectedWidth: 2,
  expectedHeight: 2,
  expectedPixels: [
    { x: 0, y: 0, r: 255, g: 0, b: 0, a: 255 },
    { x: 1, y: 0, r: 0, g: 255, b: 0, a: 255 },
    { x: 0, y: 1, r: 0, g: 0, b: 255, a: 255 },
    { x: 1, y: 1, r: 255, g: 255, b: 255, a: 255 }
  ],
  tolerance: 15
  // AVIF is lossy; wider tolerance needed
};
const HEIC_BASE_DECODE = {
  format: ImageFormat.HEIC,
  feature: FormatFeature.BASE_DECODE,
  // Minimal 2x2 HEIC with RGBW pixels
  base64: "AAAAGGZ0eXBoZWljAAAAAGhlaWNtaWYx",
  mimeType: "image/heic",
  expectedWidth: 2,
  expectedHeight: 2,
  expectedPixels: [
    { x: 0, y: 0, r: 255, g: 0, b: 0, a: 255 },
    { x: 1, y: 0, r: 0, g: 255, b: 0, a: 255 },
    { x: 0, y: 1, r: 0, g: 0, b: 255, a: 255 },
    { x: 1, y: 1, r: 255, g: 255, b: 255, a: 255 }
  ],
  tolerance: 15
};
const WEBP_ALPHA = {
  format: ImageFormat.WebP,
  feature: FormatFeature.ALPHA,
  base64: "UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoCAAIAP/3+/3+/ureyMD/z6A/JiWAAzZL/AD4A/Ov9d/sXuKGBAAD++KK3EKajfxD/97fYjrMR1AZmH8Mh2oPNqAAAAA==",
  mimeType: "image/webp",
  expectedWidth: 2,
  expectedHeight: 2,
  expectedPixels: [
    { x: 0, y: 0, r: 255, g: 0, b: 0, a: 128 },
    // Semi-transparent red
    { x: 1, y: 1, r: 0, g: 0, b: 0, a: 0 }
    // Fully transparent
  ],
  tolerance: 5
};
const PROBE_BANK = /* @__PURE__ */ new Map([
  // WebP
  [probeKey(ImageFormat.WebP, FormatFeature.BASE_DECODE), WEBP_BASE_DECODE],
  [probeKey(ImageFormat.WebP, FormatFeature.ALPHA), WEBP_ALPHA],
  // AVIF
  [probeKey(ImageFormat.AVIF, FormatFeature.BASE_DECODE), AVIF_BASE_DECODE],
  // HEIC
  [probeKey(ImageFormat.HEIC, FormatFeature.BASE_DECODE), HEIC_BASE_DECODE]
]);
function probeKey(format, feature) {
  return `${format}:${feature}`;
}
function getProbeAsset(format, feature) {
  return PROBE_BANK.get(probeKey(format, feature));
}
function getProbableFormats() {
  const formats = [];
  for (const [key] of PROBE_BANK) {
    if (key.endsWith(`:${FormatFeature.BASE_DECODE}`)) {
      const format = key.split(":")[0];
      formats.push(format);
    }
  }
  return formats;
}
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
function base64ToBlob(base64, mimeType) {
  const buffer = base64ToArrayBuffer(base64);
  return new Blob([buffer], { type: mimeType });
}
async function blobToArrayBuffer(blob) {
  if ("arrayBuffer" in blob) {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
function hasWorkerSupport() {
  return isBrowser() && typeof Worker !== "undefined";
}
function hasOffscreenCanvas() {
  return isBrowser() && typeof OffscreenCanvas !== "undefined";
}
function hasCreateImageBitmap() {
  return isBrowser() && typeof createImageBitmap === "function";
}
function hasIndexedDB() {
  return isBrowser() && typeof indexedDB !== "undefined";
}
function assertBrowser(operation) {
  if (!isBrowser()) {
    throw new Error(
      `[vue-image-parser] ${operation} requires a browser environment. This operation is not available during server-side rendering. Use onMounted() or <ClientOnly> to defer this operation.`
    );
  }
}
const DEFAULT_PROBE_TIMEOUT = 5e3;
const DEFAULT_PERF_THRESHOLD_MS = 100;
async function runDecodeTest(asset, options = {}) {
  const timeout = options.timeout ?? DEFAULT_PROBE_TIMEOUT;
  const perfThreshold = options.performanceThresholdMs ?? DEFAULT_PERF_THRESHOLD_MS;
  const startTime = performance.now();
  if (!hasCreateImageBitmap()) {
    return createFailResult(asset, startTime, "createImageBitmap not available");
  }
  try {
    const blob = base64ToBlob(asset.base64, asset.mimeType);
    const bitmap = await promiseWithTimeout(
      createImageBitmap(blob),
      timeout,
      `Decode timed out after ${timeout}ms`
    );
    const decodeTimeMs = performance.now() - startTime;
    if (bitmap.width === 0 || bitmap.height === 0) {
      bitmap.close();
      return createResult(asset, {
        loadSucceeded: true,
        dimensionsMatch: false,
        pixelResults: [],
        pixelAccuracy: 0,
        decodeTimeMs,
        support: SupportLevel.NO_SUPPORT,
        diagnostic: `Decoded to 0×0 bitmap (createImageBitmap returned empty)`,
        startTime
      });
    }
    const dimensionsMatch = bitmap.width === asset.expectedWidth && bitmap.height === asset.expectedHeight;
    if (!dimensionsMatch) {
      bitmap.close();
      return createResult(asset, {
        loadSucceeded: true,
        dimensionsMatch: false,
        pixelResults: [],
        pixelAccuracy: 0,
        decodeTimeMs,
        support: SupportLevel.NO_SUPPORT,
        diagnostic: `Dimension mismatch: expected ${asset.expectedWidth}×${asset.expectedHeight}, got ${bitmap.width}×${bitmap.height}`,
        startTime
      });
    }
    const pixelData = readPixelsFromBitmap(bitmap, asset.expectedWidth, asset.expectedHeight);
    bitmap.close();
    if (!pixelData) {
      return createResult(asset, {
        loadSucceeded: true,
        dimensionsMatch: true,
        pixelResults: [],
        pixelAccuracy: 0,
        decodeTimeMs,
        support: SupportLevel.NO_SUPPORT,
        diagnostic: "Failed to read pixel data from canvas",
        startTime
      });
    }
    const pixelResults = comparePixels(pixelData, asset);
    const passingPixels = pixelResults.filter((r) => r.passes).length;
    const pixelAccuracy = pixelResults.length > 0 ? passingPixels / pixelResults.length : 0;
    let support;
    let diagnostic;
    if (pixelAccuracy === 1) {
      if (decodeTimeMs > perfThreshold) {
        support = SupportLevel.PARTIAL_SUPPORT;
        diagnostic = `Pixels correct but decode slow (${decodeTimeMs.toFixed(1)}ms > ${perfThreshold}ms threshold)`;
      } else {
        support = SupportLevel.FULL_SUPPORT;
        diagnostic = `All ${pixelResults.length} pixels match within tolerance (${decodeTimeMs.toFixed(1)}ms)`;
      }
    } else if (pixelAccuracy > 0) {
      support = SupportLevel.PARTIAL_SUPPORT;
      diagnostic = `${passingPixels}/${pixelResults.length} pixels match (${(pixelAccuracy * 100).toFixed(0)}% accuracy)`;
    } else {
      support = SupportLevel.NO_SUPPORT;
      diagnostic = `No pixels match expected values (0% accuracy)`;
    }
    return createResult(asset, {
      loadSucceeded: true,
      dimensionsMatch: true,
      pixelResults,
      pixelAccuracy,
      decodeTimeMs,
      support,
      diagnostic,
      startTime
    });
  } catch (error) {
    const decodeTimeMs = performance.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return createResult(asset, {
      loadSucceeded: false,
      dimensionsMatch: false,
      pixelResults: [],
      pixelAccuracy: 0,
      decodeTimeMs,
      support: SupportLevel.NO_SUPPORT,
      diagnostic: `Native decode failed: ${message}`
    });
  }
}
function readPixelsFromBitmap(bitmap, width, height) {
  try {
    if (hasOffscreenCanvas()) {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, width, height).data;
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, width, height).data;
    }
  } catch {
    return null;
  }
}
function comparePixels(pixelData, asset) {
  const results = [];
  for (const expected of asset.expectedPixels) {
    const offset = (expected.y * asset.expectedWidth + expected.x) * 4;
    if (offset + 3 >= pixelData.length) {
      results.push({
        x: expected.x,
        y: expected.y,
        expected: { r: expected.r, g: expected.g, b: expected.b, a: expected.a },
        actual: { r: 0, g: 0, b: 0, a: 0 },
        maxDelta: 255,
        passes: false
      });
      continue;
    }
    const actual = {
      r: pixelData[offset],
      g: pixelData[offset + 1],
      b: pixelData[offset + 2],
      a: pixelData[offset + 3]
    };
    const maxDelta = Math.max(
      Math.abs(expected.r - actual.r),
      Math.abs(expected.g - actual.g),
      Math.abs(expected.b - actual.b),
      Math.abs(expected.a - actual.a)
    );
    results.push({
      x: expected.x,
      y: expected.y,
      expected: { r: expected.r, g: expected.g, b: expected.b, a: expected.a },
      actual,
      maxDelta,
      passes: maxDelta <= asset.tolerance
    });
  }
  return results;
}
function promiseWithTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
function createFailResult(asset, startTime, diagnostic) {
  return createResult(asset, {
    loadSucceeded: false,
    dimensionsMatch: false,
    pixelResults: [],
    pixelAccuracy: 0,
    decodeTimeMs: performance.now() - startTime,
    support: SupportLevel.NO_SUPPORT,
    diagnostic
  });
}
function createResult(asset, data) {
  return {
    format: asset.format,
    feature: asset.feature,
    loadSucceeded: data.loadSucceeded,
    dimensionsMatch: data.dimensionsMatch,
    pixelResults: data.pixelResults,
    pixelAccuracy: data.pixelAccuracy,
    decodeTimeMs: data.decodeTimeMs,
    support: data.support,
    diagnostic: data.diagnostic,
    timestamp: Date.now()
  };
}
const DB_NAME = "vue-image-parser-capabilities";
const STORE_NAME = "probe-cache";
const DB_VERSION = 1;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
function generateBrowserFingerprint() {
  const components = [];
  if (typeof navigator !== "undefined") {
    components.push(navigator.userAgent || "");
    components.push(String(navigator.hardwareConcurrency ?? 0));
    components.push(navigator.platform || "");
  }
  if (typeof screen !== "undefined") {
    components.push(`${screen.width}x${screen.height}`);
    components.push(String(screen.colorDepth ?? 0));
  }
  const raw = components.join("|");
  return simpleHash(raw);
}
function simpleHash(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = hash * 16777619 >>> 0;
  }
  return hash.toString(36);
}
function openDB() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function persistProbeResults(results, ttlMs = DEFAULT_TTL_MS) {
  try {
    const db = await openDB();
    const fingerprint = generateBrowserFingerprint();
    const cache = {
      fingerprint,
      results: Object.fromEntries(results),
      persistedAt: Date.now(),
      ttlMs
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(cache, "main");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    if (typeof console !== "undefined") {
      console.debug("[vue-image-parser] Failed to persist probe cache");
    }
  }
}
async function restoreProbeResults() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get("main");
      request.onsuccess = () => {
        const cache = request.result;
        if (!cache) {
          resolve(null);
          return;
        }
        const currentFingerprint = generateBrowserFingerprint();
        if (cache.fingerprint !== currentFingerprint) {
          if (typeof console !== "undefined") {
            console.debug("[vue-image-parser] Probe cache invalidated: browser fingerprint changed");
          }
          resolve(null);
          return;
        }
        const age = Date.now() - cache.persistedAt;
        if (age > cache.ttlMs) {
          if (typeof console !== "undefined") {
            console.debug(`[vue-image-parser] Probe cache expired (age: ${Math.round(age / 864e5)}d)`);
          }
          resolve(null);
          return;
        }
        resolve(new Map(Object.entries(cache.results)));
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}
function cacheKey(format, feature) {
  return `${format}:${feature}`;
}
class CapabilityRegistryImpl {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
    this.inFlight = /* @__PURE__ */ new Map();
    this.downgradedFormats = /* @__PURE__ */ new Set();
  }
  // ─── Public API ──────────────────────────────────────────────
  /**
   * Query cached support level for a format. Does NOT trigger a probe.
   * Returns UNKNOWN recommendation if the format has never been probed.
   */
  query(format, feature = FormatFeature.BASE_DECODE) {
    if (UNIVERSALLY_SUPPORTED_FORMATS.has(format)) {
      return this.createUniversalResult(format);
    }
    return this.buildFormatResult(format);
  }
  /**
   * Run a pixel-verified decode probe for a format/feature.
   * Returns cached result unless force=true.
   */
  async probe(format, feature = FormatFeature.BASE_DECODE, options = {}) {
    if (UNIVERSALLY_SUPPORTED_FORMATS.has(format)) {
      return this.createSyntheticProbeResult(format, feature, SupportLevel.FULL_SUPPORT);
    }
    const key = cacheKey(format, feature);
    if (!options.force && this.cache.has(key)) {
      return this.cache.get(key);
    }
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }
    const probePromise = this.executeProbe(format, feature, options);
    this.inFlight.set(key, probePromise);
    try {
      const result = await probePromise;
      this.cache.set(key, result);
      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }
  /**
   * Run base-decode probes for all registered formats concurrently.
   */
  async probeAll(options = {}) {
    const formats = options.formats ?? getProbableFormats();
    const concurrency = options.concurrency ?? 3;
    const batches = [];
    for (let i = 0; i < formats.length; i += concurrency) {
      batches.push(formats.slice(i, i + concurrency));
    }
    for (const batch of batches) {
      await Promise.all(
        batch.map((format) => this.probe(format, FormatFeature.BASE_DECODE, options))
      );
    }
    const results = /* @__PURE__ */ new Map();
    for (const format of formats) {
      results.set(format, this.buildFormatResult(format));
    }
    return results;
  }
  /**
   * Get pipeline recommendation for a format.
   * 
   * This is the primary entry point used by engine/loader.ts.
   *
   * - If probed with FULL_SUPPORT → 'use_native'
   * - If unprobed → 'use_wasm' (conservative), starts background probe
   * - If probed with anything else → 'use_wasm'
   * - If downgraded via onNativeDecodeFailure → 'use_wasm'
   */
  async resolve(format) {
    if (UNIVERSALLY_SUPPORTED_FORMATS.has(format)) {
      return "use_native";
    }
    if (this.downgradedFormats.has(format)) {
      return "use_wasm";
    }
    if (!isBrowser()) {
      return "use_wasm";
    }
    const key = cacheKey(format, FormatFeature.BASE_DECODE);
    const cached = this.cache.get(key);
    if (cached) {
      return cached.support === SupportLevel.FULL_SUPPORT ? "use_native" : "use_wasm";
    }
    this.probe(format, FormatFeature.BASE_DECODE).catch(() => {
    });
    return "use_wasm";
  }
  /**
   * Invalidate cached probe results for a format.
   * Next resolve() call will re-probe.
   */
  invalidate(format) {
    for (const [key] of this.cache) {
      if (key.startsWith(`${format}:`)) {
        this.cache.delete(key);
      }
    }
    this.downgradedFormats.delete(format);
  }
  /**
   * Runtime failure feedback.
   *
   * Called by native-codec.ts when createImageBitmap fails for an image
   * that the probe said should be FULL_SUPPORT.
   *
   * This immediately downgrades the format and triggers a re-probe.
   */
  onNativeDecodeFailure(format, error) {
    if (typeof console !== "undefined") {
      console.warn(
        `[vue-image-parser] Native decode failed for ${format} after probe indicated support. Downgrading to WASM.`,
        error.message
      );
    }
    this.downgradedFormats.add(format);
    this.invalidate(format);
    this.downgradedFormats.add(format);
    this.probe(format, FormatFeature.BASE_DECODE, { force: true }).catch(() => {
    });
  }
  /**
   * Persist all cached probe results to IndexedDB.
   */
  async persist() {
    await persistProbeResults(this.cache);
  }
  /**
   * Restore probe results from IndexedDB.
   * Returns true if valid cache was found and loaded.
   */
  async restore() {
    const cached = await restoreProbeResults();
    if (!cached) return false;
    for (const [key, result] of cached) {
      this.cache.set(key, result);
    }
    return true;
  }
  // ─── Private ─────────────────────────────────────────────────
  /**
   * Execute a single probe (no caching, no deduplication).
   */
  async executeProbe(format, feature, options) {
    const asset = getProbeAsset(format, feature);
    if (!asset) {
      return this.createSyntheticProbeResult(format, feature, SupportLevel.UNKNOWN);
    }
    return runDecodeTest(asset, {
      timeout: options.timeout,
      performanceThresholdMs: options.performanceThresholdMs
    });
  }
  /**
   * Build a FormatSupportResult from all cached probes for a format.
   */
  buildFormatResult(format) {
    const features = /* @__PURE__ */ new Map();
    let baseProbe;
    for (const [key, result] of this.cache) {
      if (key.startsWith(`${format}:`)) {
        const feature = key.split(":")[1];
        features.set(feature, result.support);
        if (feature === FormatFeature.BASE_DECODE) {
          baseProbe = result;
        }
      }
    }
    let recommendation;
    if (this.downgradedFormats.has(format)) {
      recommendation = "use_wasm";
    } else if (baseProbe) {
      recommendation = baseProbe.support === SupportLevel.FULL_SUPPORT ? "use_native" : "use_wasm";
    } else {
      recommendation = "unknown";
    }
    return {
      format,
      features,
      recommendation,
      verified: baseProbe !== void 0,
      lastProbeTimestamp: baseProbe?.timestamp ?? null,
      decodeTimeMs: baseProbe?.decodeTimeMs ?? null
    };
  }
  /**
   * Create a result for universally supported formats (JPEG, PNG, GIF).
   */
  createUniversalResult(format) {
    return {
      format,
      features: /* @__PURE__ */ new Map([[FormatFeature.BASE_DECODE, SupportLevel.FULL_SUPPORT]]),
      recommendation: "use_native",
      verified: true,
      lastProbeTimestamp: null,
      decodeTimeMs: null
    };
  }
  /**
   * Create a synthetic probe result for formats without a registered probe.
   */
  createSyntheticProbeResult(format, feature, support) {
    return {
      format,
      feature,
      loadSucceeded: support === SupportLevel.FULL_SUPPORT,
      dimensionsMatch: support === SupportLevel.FULL_SUPPORT,
      pixelResults: [],
      pixelAccuracy: support === SupportLevel.FULL_SUPPORT ? 1 : 0,
      decodeTimeMs: 0,
      support,
      diagnostic: support === SupportLevel.FULL_SUPPORT ? "Universally supported format" : "No probe asset registered",
      timestamp: Date.now()
    };
  }
}
let instance = null;
function getCapabilityRegistry() {
  if (!instance) {
    instance = new CapabilityRegistryImpl();
  }
  return instance;
}
class NativeCodec {
  constructor() {
    this.name = "native-browser";
    this.formats = [
      ImageFormat.JPEG,
      ImageFormat.PNG,
      ImageFormat.WebP,
      ImageFormat.GIF,
      ImageFormat.AVIF,
      ImageFormat.HEIC,
      ImageFormat.HEIF
    ];
  }
  async decode(buffer, options) {
    if (!hasCreateImageBitmap()) {
      throw new CodecError(
        ErrorCodes.DECODE_FAILED,
        "createImageBitmap is not available"
      );
    }
    const blob = new Blob([buffer]);
    try {
      const bitmap = await createImageBitmap(blob);
      if (bitmap.width === 0 || bitmap.height === 0) {
        bitmap.close();
        throw new CodecError(
          ErrorCodes.DECODE_FAILED,
          `Native decode returned 0×0 bitmap`
        );
      }
      const pixelData = this.readPixels(bitmap, options);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();
      let disposed = false;
      return {
        data: pixelData,
        width,
        height,
        format: ImageFormat.Unknown,
        // Caller sets this
        orientation: 1,
        decodePath: "native",
        dispose() {
          if (disposed) return;
          disposed = true;
        }
      };
    } catch (error) {
      if (error instanceof CodecError) throw error;
      const codecError = new CodecError(
        ErrorCodes.NATIVE_DECODE_FAILED,
        `Native decode failed: ${error.message}`,
        error
      );
      this.onDecodeFailure?.(ImageFormat.Unknown, codecError);
      throw codecError;
    }
  }
  /**
   * Read RGBA pixel data from an ImageBitmap.
   */
  readPixels(bitmap, _options) {
    const { width, height } = bitmap;
    if (hasOffscreenCanvas()) {
      const canvas2 = new OffscreenCanvas(width, height);
      const ctx2 = canvas2.getContext("2d");
      ctx2.drawImage(bitmap, 0, 0);
      return ctx2.getImageData(0, 0, width, height).data;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  }
}
var TaskPriority = /* @__PURE__ */ ((TaskPriority2) => {
  TaskPriority2[TaskPriority2["HIGH"] = 0] = "HIGH";
  TaskPriority2[TaskPriority2["NORMAL"] = 5] = "NORMAL";
  TaskPriority2[TaskPriority2["LOW"] = 10] = "LOW";
  return TaskPriority2;
})(TaskPriority || {});
class TaskQueue {
  constructor() {
    this.tasks = [];
    this.onItemAdded = null;
  }
  /**
   * Number of tasks waiting in the queue.
   */
  get length() {
    return this.tasks.length;
  }
  /**
   * Register a callback for when items are added (used by pool to wake up).
   */
  setOnItemAdded(callback) {
    this.onItemAdded = callback;
  }
  /**
   * Enqueue a task with a given priority.
   * Returns a promise that resolves when the task is processed by a worker.
   */
  enqueue(request, priority = 5, signal) {
    return new Promise((resolve, reject) => {
      const id = request.type === "decode" || request.type === "init-codec" ? request.id : `task-${Date.now()}`;
      const task = {
        id,
        request,
        priority,
        resolve,
        reject,
        signal,
        enqueuedAt: Date.now()
      };
      if (signal?.aborted) {
        reject(new Error("Task aborted before execution"));
        return;
      }
      if (signal) {
        signal.addEventListener("abort", () => {
          const index = this.tasks.indexOf(task);
          if (index !== -1) {
            this.tasks.splice(index, 1);
            reject(new Error("Task aborted while in queue"));
          }
        });
      }
      let insertIndex = this.tasks.length;
      for (let i = 0; i < this.tasks.length; i++) {
        if (this.tasks[i].priority > priority) {
          insertIndex = i;
          break;
        }
      }
      this.tasks.splice(insertIndex, 0, task);
      this.onItemAdded?.();
    });
  }
  /**
   * Dequeue the highest-priority task.
   * Returns null if the queue is empty.
   */
  dequeue() {
    if (this.tasks.length === 0) return null;
    while (this.tasks.length > 0) {
      const task = this.tasks[0];
      if (task.signal?.aborted) {
        this.tasks.shift();
        task.reject(new Error("Task aborted while in queue"));
        continue;
      }
      return this.tasks.shift();
    }
    return null;
  }
  /**
   * Clear all pending tasks, rejecting them with the given error.
   */
  clear(error) {
    const msg = error ?? new Error("Task queue cleared");
    for (const task of this.tasks) {
      task.reject(msg);
    }
    this.tasks.length = 0;
  }
}
function deserializeError(serialized) {
  const error = new Error(serialized.message);
  error.code = serialized.code;
  if (serialized.stack) error.stack = serialized.stack;
  return error;
}
function fromTransferable(transferred) {
  const data = new Uint8ClampedArray(transferred.data);
  let disposed = false;
  return {
    data,
    width: transferred.width,
    height: transferred.height,
    format: transferred.format,
    orientation: transferred.orientation,
    decodePath: transferred.decodePath,
    dispose() {
      if (disposed) return;
      disposed = true;
    }
  };
}
function getRequestTransferables(request) {
  if (request.type === "decode") {
    return [request.buffer];
  }
  return [];
}
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function defaultPoolSize() {
  if (typeof navigator === "undefined") return 1;
  const hw = navigator.hardwareConcurrency ?? 2;
  return Math.max(1, Math.min(hw - 1, 4));
}
class WorkerPool {
  constructor(config = {}) {
    this.workers = [];
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.disposed = false;
    this.maxWorkers = config.maxWorkers ?? defaultPoolSize();
    this.workerFactory = config.workerFactory ?? null;
    this.queue = new TaskQueue();
    this.queue.setOnItemAdded(() => this.processQueue());
  }
  /**
   * Submit a decode request to the pool.
   * Returns a promise that resolves when the decode is complete.
   */
  async submit(request, priority = TaskPriority.NORMAL, signal) {
    if (this.disposed) {
      throw new WorkerError(ErrorCodes.WORKER_POOL_EXHAUSTED, "Worker pool has been disposed");
    }
    if (!hasWorkerSupport()) {
      throw new WorkerError(ErrorCodes.WORKER_CRASHED, "Web Workers are not available in this environment");
    }
    return this.queue.enqueue(request, priority, signal);
  }
  /**
   * Current pool utilization.
   */
  get stats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      idleWorkers: this.workers.filter((w) => !w.busy).length,
      queuedTasks: this.queue.length
    };
  }
  /**
   * Dispose all workers and reject pending tasks.
   */
  dispose() {
    this.disposed = true;
    this.queue.clear(new WorkerError(ErrorCodes.WORKER_CRASHED, "Worker pool disposed"));
    for (const worker of this.workers) {
      worker.instance.terminate();
    }
    this.workers.length = 0;
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new WorkerError(ErrorCodes.WORKER_CRASHED, "Worker pool disposed"));
    }
    this.pendingRequests.clear();
  }
  // ─── Private ─────────────────────────────────────────────────
  /**
   * Try to process tasks from the queue.
   */
  processQueue() {
    while (this.queue.length > 0) {
      const worker = this.getIdleWorker() ?? this.spawnWorker();
      if (!worker) break;
      const task = this.queue.dequeue();
      if (!task) break;
      this.dispatch(worker, task);
    }
  }
  /**
   * Get an idle worker from the pool, or null if none available.
   */
  getIdleWorker() {
    return this.workers.find((w) => !w.busy) ?? null;
  }
  /**
   * Spawn a new worker if under the limit.
   */
  spawnWorker() {
    if (this.workers.length >= this.maxWorkers) return null;
    const instance2 = this.createWorker();
    const pooledWorker = {
      instance: instance2,
      busy: false,
      taskCount: 0,
      lastActivity: Date.now()
    };
    instance2.addEventListener("message", (event) => {
      this.handleWorkerResponse(pooledWorker, event.data);
    });
    instance2.addEventListener("error", (event) => {
      this.handleWorkerCrash(pooledWorker, event);
    });
    this.workers.push(pooledWorker);
    return pooledWorker;
  }
  /**
   * Create a worker instance.
   */
  createWorker() {
    if (this.workerFactory) {
      return this.workerFactory();
    }
    return new Worker(
      new URL(
        /* @vite-ignore */
        "" + new URL("assets/decode-worker-Bxk1S_sD.js", import.meta.url).href,
        import.meta.url
      ),
      { type: "module" }
    );
  }
  /**
   * Dispatch a task to a specific worker.
   */
  dispatch(worker, task) {
    worker.busy = true;
    worker.lastActivity = Date.now();
    worker.taskCount++;
    this.pendingRequests.set(task.id, task);
    const transferables = getRequestTransferables(task.request);
    worker.instance.postMessage(task.request, transferables);
  }
  /**
   * Handle a response from a worker.
   */
  handleWorkerResponse(worker, response) {
    worker.busy = false;
    worker.lastActivity = Date.now();
    if (response.type === "ready") {
      this.processQueue();
      return;
    }
    const id = response.id;
    const pending = this.pendingRequests.get(id);
    if (pending) {
      this.pendingRequests.delete(id);
      pending.resolve(response);
    }
    this.processQueue();
  }
  /**
   * Handle a worker crash — respawn and retry.
   */
  handleWorkerCrash(worker, event) {
    if (typeof console !== "undefined") {
      console.error("[vue-image-parser] Worker crashed:", event.message);
    }
    worker.instance.terminate();
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }
    this.processQueue();
  }
}
async function fetchAsArrayBuffer(url, options = {}) {
  const { timeout = 3e4, signal, onProgress } = options;
  const controller = new AbortController();
  let timeoutId;
  if (timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }
  const combinedSignal = signal ? combineAbortSignals(signal, controller.signal) : controller.signal;
  try {
    const response = await fetch(url, { signal: combinedSignal });
    if (!response.ok) {
      throw new FetchError(
        ErrorCodes.FETCH_FAILED,
        `HTTP ${response.status}: ${response.statusText} for ${url}`
      );
    }
    if (onProgress && response.body) {
      const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
      if (contentLength > 0) {
        return readStreamWithProgress(response.body, contentLength, onProgress);
      }
    }
    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof ImageParserError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal?.aborted) {
        throw new AbortError();
      }
      throw new TimeoutError(ErrorCodes.FETCH_TIMEOUT, `Fetch timed out after ${timeout}ms`);
    }
    throw new FetchError(
      ErrorCodes.FETCH_FAILED,
      `Failed to fetch ${url}: ${error.message}`,
      error
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
async function readStreamWithProgress(body, totalBytes, onProgress) {
  const reader = body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.byteLength;
    onProgress(Math.min(receivedBytes / totalBytes, 1));
  }
  const result = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
function combineAbortSignals(a, b) {
  if ("any" in AbortSignal) {
    return AbortSignal.any([a, b]);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  if (a.aborted || b.aborted) {
    controller.abort();
  }
  return controller.signal;
}
function readExifOrientation(buffer) {
  const view = new DataView(buffer);
  const length = Math.min(buffer.byteLength, 65536);
  if (length < 2 || view.getUint16(0) !== 65496) {
    return 1;
  }
  let offset = 2;
  while (offset < length - 4) {
    const marker = view.getUint16(offset);
    offset += 2;
    if (marker === 65505) {
      const segmentLength = view.getUint16(offset);
      offset += 2;
      if (offset + 6 >= length || view.getUint32(offset) !== 1165519206 || // "Exif"
      view.getUint16(offset + 4) !== 0) {
        return 1;
      }
      return parseExifOrientation(view, offset + 6, segmentLength - 8);
    }
    if ((marker & 65280) === 65280) {
      const segLen = view.getUint16(offset);
      offset += segLen;
    } else {
      break;
    }
  }
  return 1;
}
function parseExifOrientation(view, tiffStart, maxLength) {
  const end = Math.min(tiffStart + maxLength, view.byteLength);
  if (tiffStart + 8 > end) return 1;
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 18761;
  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) {
    return 1;
  }
  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + ifd0Offset;
  if (ifdStart + 2 > end) return 1;
  const entryCount = view.getUint16(ifdStart, littleEndian);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > end) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 274) {
      const value = view.getUint16(entryOffset + 8, littleEndian);
      if (value >= 1 && value <= 8) {
        return value;
      }
    }
  }
  return 1;
}
function applyOrientation(data, width, height, orientation) {
  if (orientation === 1) {
    return { data, width, height };
  }
  const swapDimensions = orientation >= 5;
  const outWidth = swapDimensions ? height : width;
  const outHeight = swapDimensions ? width : height;
  const result = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      let dstX, dstY;
      switch (orientation) {
        case 2:
          dstX = width - 1 - x;
          dstY = y;
          break;
        case 3:
          dstX = width - 1 - x;
          dstY = height - 1 - y;
          break;
        case 4:
          dstX = x;
          dstY = height - 1 - y;
          break;
        case 5:
          dstX = y;
          dstY = x;
          break;
        case 6:
          dstX = height - 1 - y;
          dstY = x;
          break;
        case 7:
          dstX = height - 1 - y;
          dstY = width - 1 - x;
          break;
        case 8:
          dstX = y;
          dstY = width - 1 - x;
          break;
        default:
          dstX = x;
          dstY = y;
      }
      const dstIdx = (dstY * outWidth + dstX) * 4;
      result[dstIdx] = data[srcIdx];
      result[dstIdx + 1] = data[srcIdx + 1];
      result[dstIdx + 2] = data[srcIdx + 2];
      result[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { data: result, width: outWidth, height: outHeight };
}
let workerPool = null;
let nativeCodec = null;
function getWorkerPool() {
  if (!workerPool) {
    workerPool = new WorkerPool();
  }
  return workerPool;
}
function getNativeCodec() {
  if (!nativeCodec) {
    nativeCodec = new NativeCodec();
    nativeCodec.onDecodeFailure = (format, error) => {
      getCapabilityRegistry().onNativeDecodeFailure(format, error);
    };
  }
  return nativeCodec;
}
async function loadImage(source, options = {}) {
  const {
    signal,
    timeout = 3e4,
    strategy = "auto",
    maxDimension,
    autoOrient = true,
    onProgress
  } = options;
  if (signal?.aborted) {
    throw new AbortError();
  }
  const buffer = await resolveSource(source, { signal, timeout, onProgress });
  if (signal?.aborted) throw new AbortError();
  const format = detectFormat(buffer);
  if (format === ImageFormat.Unknown) {
    throw new FormatDetectionError(
      ErrorCodes.FORMAT_DETECTION_FAILED,
      "Could not identify image format from binary signature"
    );
  }
  let decodePath;
  if (strategy === "native") {
    decodePath = "native";
  } else if (strategy === "wasm") {
    decodePath = "wasm";
  } else {
    const capability = getCapabilityRegistry();
    const resolved = await capability.resolve(format);
    decodePath = resolved === "use_native" ? "native" : "wasm";
  }
  if (signal?.aborted) throw new AbortError();
  let decoded;
  if (decodePath === "native") {
    decoded = await decodeNative(buffer, format, { maxDimension });
  } else {
    decoded = await decodeViaWorker(buffer, format, signal);
  }
  if (autoOrient && format === ImageFormat.JPEG) {
    const orientation = readExifOrientation(buffer);
    if (orientation !== 1) {
      const oriented = applyOrientation(decoded.data, decoded.width, decoded.height, orientation);
      const original = decoded;
      decoded = {
        ...decoded,
        data: oriented.data,
        width: oriented.width,
        height: oriented.height,
        orientation: 1
      };
      original.dispose();
    }
  }
  if (decoded.format === ImageFormat.Unknown || !decoded.format) {
    decoded = { ...decoded, format, decodePath };
  }
  return decoded;
}
function disposeEngine() {
  workerPool?.dispose();
  workerPool = null;
  nativeCodec = null;
}
async function resolveSource(source, options) {
  if (source instanceof ArrayBuffer) {
    return source;
  }
  if (source instanceof Blob) {
    return blobToArrayBuffer(source);
  }
  if (typeof source === "string") {
    return fetchAsArrayBuffer(source, options);
  }
  throw new ImageParserError(
    ErrorCodes.INVALID_INPUT,
    `Invalid image source type: ${typeof source}`
  );
}
async function decodeNative(buffer, format, options) {
  const codec = getNativeCodec();
  try {
    const decoded = await codec.decode(buffer, {
      maxDimension: options.maxDimension
    });
    return { ...decoded, format };
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn(`[vue-image-parser] Native decode failed for ${format}, falling back to WASM`);
    }
    getCapabilityRegistry().onNativeDecodeFailure(
      format,
      error instanceof Error ? error : new Error(String(error))
    );
    if (hasWorkerSupport()) {
      return decodeViaWorker(buffer, format, void 0);
    }
    throw error;
  }
}
async function decodeViaWorker(buffer, format, signal, _options) {
  if (!hasWorkerSupport()) {
    throw new CodecError(
      ErrorCodes.WORKER_CRASHED,
      "Web Workers required for WASM decoding but not available"
    );
  }
  const pool = getWorkerPool();
  const id = generateRequestId();
  const response = await pool.submit(
    {
      type: "decode",
      id,
      buffer,
      format
    },
    TaskPriority.HIGH,
    signal
  );
  if (response.type === "decode-error") {
    throw deserializeError(response.error);
  }
  if (response.type === "decode-result") {
    return fromTransferable(response.image);
  }
  throw new CodecError(
    ErrorCodes.DECODE_FAILED,
    `Unexpected worker response type: ${response.type}`
  );
}
function calculateFitDimensions(srcWidth, srcHeight, containerWidth, containerHeight, fit) {
  switch (fit) {
    case "fill":
      return { x: 0, y: 0, width: containerWidth, height: containerHeight };
    case "none":
      return {
        x: (containerWidth - srcWidth) / 2,
        y: (containerHeight - srcHeight) / 2,
        width: srcWidth,
        height: srcHeight
      };
    case "contain": {
      const scale = Math.min(containerWidth / srcWidth, containerHeight / srcHeight);
      const w = srcWidth * scale;
      const h = srcHeight * scale;
      return {
        x: (containerWidth - w) / 2,
        y: (containerHeight - h) / 2,
        width: w,
        height: h
      };
    }
    case "cover": {
      const scale = Math.max(containerWidth / srcWidth, containerHeight / srcHeight);
      const w = srcWidth * scale;
      const h = srcHeight * scale;
      return {
        x: (containerWidth - w) / 2,
        y: (containerHeight - h) / 2,
        width: w,
        height: h
      };
    }
    case "scale-down": {
      if (srcWidth <= containerWidth && srcHeight <= containerHeight) {
        return {
          x: (containerWidth - srcWidth) / 2,
          y: (containerHeight - srcHeight) / 2,
          width: srcWidth,
          height: srcHeight
        };
      }
      const scale = Math.min(containerWidth / srcWidth, containerHeight / srcHeight);
      const w = srcWidth * scale;
      const h = srcHeight * scale;
      return {
        x: (containerWidth - w) / 2,
        y: (containerHeight - h) / 2,
        width: w,
        height: h
      };
    }
  }
}
function renderToCanvas(canvas, image, options = {}) {
  const {
    width = image.width,
    height = image.height,
    fit = "contain",
    background,
    dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1
  } = options;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  const imageData = new ImageData(image.data, image.width, image.height);
  const dims = calculateFitDimensions(image.width, image.height, width, height, fit);
  if (dims.width !== image.width || dims.height !== image.height) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, dims.x, dims.y, dims.width, dims.height);
  } else {
    ctx.putImageData(imageData, dims.x, dims.y);
  }
}
function renderImage(target, image, options = {}) {
  assertBrowser("renderImage()");
  if (target instanceof HTMLCanvasElement) {
    renderToCanvas(target, image, options);
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const rect = target.getBoundingClientRect();
  const renderOptions = {
    width: options.width ?? (rect.width || image.width),
    height: options.height ?? (rect.height || image.height),
    ...options
  };
  try {
    renderToCanvas(canvas, image, renderOptions);
    target.innerHTML = "";
    target.appendChild(canvas);
  } catch (error) {
    throw new ImageParserError(
      ErrorCodes.RENDER_FAILED,
      `Failed to render image: ${error.message}`,
      error
    );
  }
}
function useImage(source, options) {
  const loading = ref(false);
  const decoded = shallowRef(null);
  const error = ref(null);
  const format = ref(null);
  let abortController = null;
  async function load(src, loadOptions) {
    if (!isBrowser()) return;
    abortController?.abort();
    abortController = new AbortController();
    decoded.value?.dispose();
    decoded.value = null;
    error.value = null;
    loading.value = true;
    const opts = loadOptions ?? (options ? toValue(options) : void 0);
    try {
      const result = await loadImage(src, {
        ...opts,
        signal: abortController.signal
      });
      decoded.value = result;
      format.value = result.format;
      error.value = null;
    } catch (err) {
      if (err.name === "AbortError" || err.code === "ABORTED") {
        return;
      }
      error.value = err instanceof Error ? err : new Error(String(err));
      decoded.value = null;
    } finally {
      loading.value = false;
    }
  }
  function dispose() {
    abortController?.abort();
    abortController = null;
    decoded.value?.dispose();
    decoded.value = null;
    error.value = null;
    format.value = null;
    loading.value = false;
  }
  if (source !== void 0) {
    watch(
      () => toValue(source),
      (newSource) => {
        if (newSource) {
          load(newSource);
        } else {
          dispose();
        }
      },
      { immediate: true }
    );
  }
  onBeforeUnmount(dispose);
  return {
    loading: readonly(loading),
    decoded: shallowReadonly(decoded),
    error: readonly(error),
    format: readonly(format),
    load,
    dispose
  };
}
async function toImageBitmap(image) {
  if (!hasCreateImageBitmap()) return null;
  try {
    const imageData = new ImageData(image.data, image.width, image.height);
    return await createImageBitmap(imageData);
  } catch {
    return null;
  }
}
function toDataURL(image, mimeType = "image/png") {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  const imageData = new ImageData(image.data, image.width, image.height);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL(mimeType);
}
async function toBlobURL(image, mimeType = "image/png") {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  const imageData = new ImageData(image.data, image.width, image.height);
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      },
      mimeType
    );
  });
}
const _hoisted_1 = {
  key: 0,
  class: "universal-image__placeholder"
};
const _hoisted_2 = {
  key: 1,
  class: "universal-image__error"
};
const _hoisted_3 = ["src", "alt"];
const _hoisted_4 = ["src", "alt"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "UniversalImage",
  props: {
    src: {},
    alt: { default: "" },
    width: {},
    height: {},
    fit: { default: "contain" },
    background: {},
    strategy: { default: "auto" },
    fallbackSrc: {},
    placeholder: { type: Boolean, default: true },
    lazy: { type: Boolean, default: false }
  },
  emits: ["load", "error"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const containerRef = ref(null);
    const canvasRef = ref(null);
    const imgSrc = ref(null);
    const isVisible = ref(!props.lazy);
    const effectiveSource = computed(() => {
      if (!isVisible.value) return null;
      return props.src;
    });
    const loadOptions = computed(() => ({
      strategy: props.strategy
    }));
    const { loading, decoded, error, format } = useImage(effectiveSource, loadOptions);
    watch(decoded, (image) => {
      if (!image) {
        imgSrc.value = null;
        return;
      }
      try {
        imgSrc.value = toDataURL(image);
        emit("load", { format: format.value, width: image.width, height: image.height });
      } catch (err) {
        if (canvasRef.value) {
          const renderOptions = {
            fit: props.fit,
            background: props.background
          };
          renderImage(canvasRef.value, image, renderOptions);
        }
      }
    });
    watch(error, (err) => {
      if (err) emit("error", err);
    });
    onMounted(() => {
      if (!props.lazy || !isBrowser()) {
        isVisible.value = true;
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            isVisible.value = true;
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      if (containerRef.value) {
        observer.observe(containerRef.value);
      }
      onBeforeUnmount(() => observer.disconnect());
    });
    const containerStyle = computed(() => ({
      width: typeof props.width === "number" ? `${props.width}px` : props.width,
      height: typeof props.height === "number" ? `${props.height}px` : props.height,
      position: "relative",
      overflow: "hidden",
      display: "inline-block"
    }));
    const imgStyle = computed(() => ({
      width: "100%",
      height: "100%",
      objectFit: props.fit,
      display: "block"
    }));
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "containerRef",
        ref: containerRef,
        style: normalizeStyle(containerStyle.value),
        class: "universal-image"
      }, [
        unref(loading) && __props.placeholder ? (openBlock(), createElementBlock("div", _hoisted_1, [
          renderSlot(_ctx.$slots, "loading", {}, () => [
            _cache[0] || (_cache[0] = createElementVNode("div", { class: "universal-image__spinner" }, null, -1))
          ], true)
        ])) : unref(error) && !__props.fallbackSrc ? (openBlock(), createElementBlock("div", _hoisted_2, [
          renderSlot(_ctx.$slots, "error", { error: unref(error) }, () => [
            _cache[1] || (_cache[1] = createElementVNode("span", null, "⚠️ Failed to load image", -1))
          ], true)
        ])) : unref(error) && __props.fallbackSrc ? (openBlock(), createElementBlock("img", {
          key: 2,
          src: __props.fallbackSrc,
          alt: __props.alt,
          style: normalizeStyle(imgStyle.value)
        }, null, 12, _hoisted_3)) : imgSrc.value ? (openBlock(), createElementBlock("img", {
          key: 3,
          src: imgSrc.value,
          alt: __props.alt,
          style: normalizeStyle(imgStyle.value)
        }, null, 12, _hoisted_4)) : (openBlock(), createElementBlock("canvas", {
          key: 4,
          ref_key: "canvasRef",
          ref: canvasRef,
          style: normalizeStyle(imgStyle.value)
        }, null, 4))
      ], 4);
    };
  }
});
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const UniversalImage = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-282ffdef"]]);
const ImageParserPlugin = {
  install(app) {
    app.component("UniversalImage", UniversalImage);
  }
};
export {
  AbortError,
  CodecError,
  ErrorCodes,
  FetchError,
  FormatDetectionError,
  FormatFeature,
  ImageFormat,
  ImageParserError,
  ImageParserPlugin,
  SupportLevel,
  TimeoutError,
  UNIVERSALLY_SUPPORTED_FORMATS,
  UniversalImage,
  WorkerError,
  detectFormat,
  detectFormatFromBlob,
  disposeEngine,
  getCapabilityRegistry,
  loadImage,
  renderImage,
  toBlobURL,
  toDataURL,
  toImageBitmap,
  useImage
};
//# sourceMappingURL=index.js.map
