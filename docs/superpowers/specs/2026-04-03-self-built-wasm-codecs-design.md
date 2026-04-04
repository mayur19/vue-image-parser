# Performance Optimization

**Date:** 2026-04-03
**Status:** Draft
**Scope:** Fix 7 performance bottlenecks in the image decode and render pipeline

## Summary

Address 7 performance issues across the decode pipeline, rendering path, and worker infrastructure. These fixes affect every image load on every browser — the highest-impact improvements available without architectural changes.

WASM codec dependencies (libheif-js, @jsquash/avif) are kept as-is. Browser native support for HEIC and AVIF is expanding rapidly, and the capability registry already routes to native when available.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| WASM dependencies | Keep libheif-js + @jsquash/avif | Maintained, functional; browser native support is catching up |
| Scope | Performance fixes only | Highest user-visible impact per effort |

---

## 1. Replace toDataURL() with Blob URL

**Files:** `src/vue/UniversalImage.vue`, `src/rendering/bitmap-renderer.ts`

**Problem:** `toDataURL('image/png')` re-encodes raw RGBA as PNG synchronously on the main thread. For a 4000x3000 image this takes 50-200ms and produces a ~30MB base64 string that must be parsed again by the `<img>` element.

**Fix:** Replace with `toBlobURL()` which uses `canvas.toBlob()` (async, off-main-thread in most browsers). The component tracks the blob URL and calls `URL.revokeObjectURL()` on dispose/re-render.

Changes in `UniversalImage.vue`:
- `watch(decoded)` becomes async, calls `toBlobURL(image)` instead of `toDataURL(image)`
- Previous blob URL is revoked before assigning the new one
- `onBeforeUnmount` revokes the current blob URL

Changes in `bitmap-renderer.ts`:
- No code changes needed — `toBlobURL()` already exists and works correctly

---

## 2. GPU-Accelerated EXIF Orientation

**File:** `src/rendering/exif.ts`

**Problem:** `applyOrientation()` iterates every pixel (12M iterations for a 12MP image) with a per-pixel switch statement and 4 byte copies each. This runs synchronously on the main thread.

**Fix:** Replace with canvas transform approach:

1. Create temp `OffscreenCanvas` at source dimensions, put source RGBA via `putImageData`
2. Create output `OffscreenCanvas` at oriented dimensions (swapped for orientations 5-8)
3. Apply the transform matrix to output ctx (`translate` + `rotate` + `scale` per orientation)
4. `ctx.drawImage(tempCanvas, 0, 0)` — GPU-accelerated compositing
5. Read back oriented pixels with `getImageData`

One allocation + one GPU blit instead of 12M iterations. The existing `applyOrientation` function signature is preserved — only the implementation changes. The pixel-by-pixel version is kept as a fallback for environments without `OffscreenCanvas`.

Transform matrix per orientation:

| Orientation | translate | scale | rotate |
|-------------|-----------|-------|--------|
| 2 | (width, 0) | (-1, 1) | — |
| 3 | (width, height) | (-1, -1) | — |
| 4 | (0, height) | (1, -1) | — |
| 5 | (0, 0) | (1, -1) | 90° CW |
| 6 | (height, 0) | — | 90° CW |
| 7 | (height, width) | (-1, 1) | 90° CW |
| 8 | (0, width) | — | -90° CW |

---

## 3. Keep ImageBitmap Alive on Native Path

**Files:** `src/codecs/native-codec.ts`, `src/types/image.ts`, `src/rendering/canvas-renderer.ts`

**Problem:** `NativeCodec.decode()` creates an `ImageBitmap` via `createImageBitmap()`, immediately reads all pixels via `getImageData()` into a `Uint8ClampedArray`, then closes the bitmap. The pixel readback is expensive and unnecessary when the consumer just wants to render to canvas or `<img>`.

**Fix:** Extend `DecodedImage` with an optional `bitmap` field:

```typescript
interface DecodedImage {
  // existing fields...
  bitmap?: ImageBitmap;
}
```

`NativeCodec.decode()` keeps the `ImageBitmap` alive on the `DecodedImage`. The RGBA `data` field becomes lazy — backed by a getter that only performs the `getImageData` readback when first accessed. This way:

- Consumers that render to canvas use `drawImage(bitmap)` directly (zero-copy, GPU path)
- Consumers that need raw RGBA (e.g., pixel comparison) still get it on demand
- `dispose()` calls `bitmap.close()`

`renderToCanvas()` checks for `image.bitmap` and uses `ctx.drawImage(bitmap, ...)` when available, skipping the `ImageData` → `putImageData` path entirely.

---

## 4. Canvas Pooling for Rendering

**Files:** New `src/rendering/canvas-pool.ts`, `src/rendering/canvas-renderer.ts`

**Problem:** `renderToCanvas()` creates a new temporary `document.createElement('canvas')` on every non-1:1 render. These canvases are never reused.

**Fix:** A 2-slot LRU pool for temporary canvases:

```typescript
interface PoolEntry {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  lastUsed: number;
}

class CanvasPool {
  private readonly slots: PoolEntry[] = [];
  private readonly maxSlots = 2;

  acquire(width: number, height: number): HTMLCanvasElement | OffscreenCanvas
  // Returns existing canvas if dimensions match, otherwise evicts oldest

  release(canvas: HTMLCanvasElement | OffscreenCanvas): void
  // Returns canvas to pool

  dispose(): void
  // Clears all slots
}
```

Most apps render at 1-2 distinct sizes, so a 2-slot pool avoids nearly all canvas allocations after the first render. `renderToCanvas()` calls `pool.acquire()` / `pool.release()` instead of `document.createElement('canvas')`.

---

## 5. Codec Pre-warming

**Files:** `src/engine/loader.ts`, `src/workers/pool.ts`, `src/index.ts`

**Problem:** The first HEIC/AVIF decode pays 100-300ms WASM initialization cost. The `init-codec` worker message type exists in `decode-worker.ts` but is never sent proactively.

**Fix:** New public API function:

```typescript
export async function warmup(formats: ImageFormat[]): Promise<void>
```

Implementation:
- Gets the worker pool singleton
- For each format, sends an `init-codec` request to an idle worker at `TaskPriority.LOW`
- The worker's existing `handleInitCodec` handler loads and initializes the codec
- Subsequent decode requests skip init entirely

Integration with `useImage`:
- When `useImage` mounts and the source is a string URL, it heuristically detects the format from the extension (`.heic`, `.avif`)
- If a WASM-likely format is detected, it calls `warmup([format])` immediately
- This runs in parallel with the actual fetch, so by the time the buffer arrives the codec is ready

New method on `WorkerPool`:

```typescript
async warmup(formats: ImageFormat[]): Promise<void>
// Sends init-codec to idle workers, one per format
```

---

## 6. Forward maxDimension to WASM Worker

**Files:** `src/engine/loader.ts`, `src/workers/decode-worker.ts`, `src/types/worker.ts`

**Problem:** `decodeViaWorker()` receives `options` with `maxDimension` but never includes it in the `WorkerRequest`. Large images decode at full resolution even when displayed at 200x200.

**Fix:**

1. Add `maxDimension?: number` to the `WorkerRequest` type (decode variant)
2. `decodeViaWorker()` passes `maxDimension` from `options` into the request
3. In `decode-worker.ts`, after WASM decode completes, if `maxDimension` is set and the decoded image exceeds it:
   - Calculate scaled dimensions (preserve aspect ratio, longest side = maxDimension)
   - Create `OffscreenCanvas` at target dimensions
   - `putImageData` the full-res RGBA, then `drawImage` scaled
   - Read back the downsampled pixels
   - Transfer the smaller buffer back (reduces transfer size)

This is a post-decode downsample — the WASM codec still decodes at full resolution (it has no resize API), but the pixel data transferred to the main thread is much smaller. For a 4000x3000 image displayed at 800x600, the transfer drops from 48MB to 1.9MB.

---

## 7. Abort Listener Cleanup in TaskQueue

**File:** `src/workers/task-queue.ts`

**Problem:** The `abort` event listener added in `enqueue()` (line 89) is never removed after the task completes. Over many requests, this accumulates listeners on `AbortSignal` objects.

**Fix:** Store the listener reference and clean it up:

```typescript
// In PendingTask interface, add:
abortListener?: () => void;

// In enqueue(), store the reference:
const listener = () => { /* existing removal logic */ };
signal.addEventListener('abort', listener);
task.abortListener = listener;

// In dequeue() and task completion (handleWorkerResponse), remove it:
if (task.abortListener && task.signal) {
  task.signal.removeEventListener('abort', task.abortListener);
  task.abortListener = undefined;
}
```

Also clean up in `clear()` when rejecting all pending tasks.

---

## Files Touched

| Action | Files |
|--------|-------|
| **New** | `src/rendering/canvas-pool.ts` |
| **Modify** | `src/vue/UniversalImage.vue` (blob URL instead of data URL) |
| **Modify** | `src/rendering/exif.ts` (GPU-accelerated orientation) |
| **Modify** | `src/rendering/canvas-renderer.ts` (canvas pool, bitmap path) |
| **Modify** | `src/codecs/native-codec.ts` (keep ImageBitmap, lazy RGBA) |
| **Modify** | `src/types/image.ts` (bitmap field on DecodedImage) |
| **Modify** | `src/types/worker.ts` (maxDimension in WorkerRequest) |
| **Modify** | `src/engine/loader.ts` (warmup API, forward maxDimension) |
| **Modify** | `src/workers/pool.ts` (warmup method) |
| **Modify** | `src/workers/task-queue.ts` (abort listener cleanup) |
| **Modify** | `src/workers/decode-worker.ts` (post-decode downsample) |
| **Modify** | `src/index.ts` (export warmup) |

---

## Testing

### Unit Tests (Vitest)

| Area | What's Tested |
|------|---------------|
| `canvas-pool.ts` | Pool reuse when dimensions match; eviction of oldest; dispose clears all |
| `exif.ts` | All 8 orientations produce correct dimensions and pixel placement vs. pixel-by-pixel reference |
| `task-queue.ts` | Abort listener removed after dequeue; no listener leak after 1000 enqueue/dequeue cycles |
| `native-codec.ts` | Lazy RGBA: `data` not read until accessed; `bitmap` present and closeable |

### Integration Tests (Vitest)

| Area | What's Tested |
|------|---------------|
| Blob URL rendering | `toBlobURL()` returns valid `blob:` URL; URL revoked on re-render |
| Warmup | `warmup(['avif'])` → subsequent decode skips WASM init (timing assertion) |
| maxDimension | 4000x3000 input with `maxDimension: 800` → output dimensions ≤ 800 on longest side |
| Full pipeline | `loadImage(jpegBuffer)` with EXIF orientation 6 → correctly oriented output |
| ImageBitmap path | Native decode → `decoded.bitmap` is valid → `renderToCanvas` uses drawImage fast path |

### Test Assets

```
test/fixtures/
├── test-64x64.avif
├── test-64x64.heic
├── test-64x64.jpg              # EXIF orientation 6 (90° CW)
├── test-64x64-reference.raw    # Expected RGBA bytes for pixel comparison
```

---

## Error Handling

No new error types needed. All fixes use existing error infrastructure:

- **Blob URL creation failure:** Falls back to canvas rendering (existing fallback path in `UniversalImage.vue`)
- **OffscreenCanvas unavailable (EXIF fix):** Falls back to pixel-by-pixel implementation (kept as fallback)
- **Lazy bitmap readback failure:** Throws existing `CodecError(NATIVE_DECODE_FAILED)`
- **Worker downsample failure:** Worker catches, returns full-resolution image (graceful degradation)
- **Warmup failure:** Non-fatal. `warmup()` catches errors silently — worst case is the first decode pays full init cost (current behavior)
