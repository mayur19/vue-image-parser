# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 performance bottlenecks in the vue-image-parser decode and render pipeline.

**Architecture:** Targeted fixes across the existing pipeline — no new subsystems. Each fix is independent and can be implemented/tested in isolation. The fixes touch rendering (blob URL, EXIF, canvas pool, bitmap fast-path), worker infrastructure (maxDimension forwarding, abort cleanup), and public API (warmup).

**Tech Stack:** TypeScript, Vitest (jsdom), Vue 3, Canvas 2D / OffscreenCanvas, Web Workers

**Spec:** `docs/superpowers/specs/2026-04-03-self-built-wasm-codecs-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| New | `src/rendering/canvas-pool.ts` | 2-slot LRU canvas pool for temp canvases |
| New | `test/rendering/canvas-pool.test.ts` | Canvas pool unit tests |
| New | `test/rendering/exif.test.ts` | EXIF orientation unit tests |
| New | `test/workers/task-queue.test.ts` | Abort listener cleanup tests |
| New | `test/codecs/native-codec.test.ts` | Lazy bitmap / ImageBitmap tests |
| New | `test/rendering/bitmap-renderer.test.ts` | Blob URL tests |
| New | `test/engine/loader.test.ts` | Warmup + maxDimension tests |
| Modify | `src/types/image.ts` | Add optional `bitmap` field to `DecodedImage` |
| Modify | `src/types/worker.ts` | Add `maxDimension` to `WorkerDecodeRequest` |
| Modify | `src/workers/task-queue.ts` | Abort listener cleanup |
| Modify | `src/codecs/native-codec.ts` | Keep ImageBitmap, lazy RGBA |
| Modify | `src/rendering/exif.ts` | GPU-accelerated orientation |
| Modify | `src/rendering/canvas-renderer.ts` | Canvas pool + bitmap fast path |
| Modify | `src/rendering/bitmap-renderer.ts` | (no changes — toBlobURL already correct) |
| Modify | `src/vue/UniversalImage.vue` | Use toBlobURL, revoke old URLs |
| Modify | `src/engine/loader.ts` | warmup(), forward maxDimension |
| Modify | `src/workers/pool.ts` | warmup() method |
| Modify | `src/workers/decode-worker.ts` | Post-decode downsample |
| Modify | `src/index.ts` | Export warmup |

---

### Task 1: Abort Listener Cleanup in TaskQueue

**Files:**
- Modify: `src/workers/task-queue.ts`
- Create: `test/workers/task-queue.test.ts`

This is the simplest fix — a good warm-up task with zero dependencies on the others.

- [ ] **Step 1: Write the failing test for abort listener cleanup**

Create `test/workers/task-queue.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TaskQueue, TaskPriority } from '@/workers/task-queue';

describe('TaskQueue', () => {
  describe('abort listener cleanup', () => {
    it('removes abort listener after task is dequeued', () => {
      const queue = new TaskQueue();
      const controller = new AbortController();

      const removeListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');

      queue.enqueue(
        { type: 'decode', id: 'test-1', buffer: new ArrayBuffer(8), format: 'jpeg' as any },
        TaskPriority.HIGH,
        controller.signal,
      );

      const task = queue.dequeue();
      expect(task).not.toBeNull();
      expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('removes abort listeners when queue is cleared', () => {
      const queue = new TaskQueue();
      const controller = new AbortController();

      const removeListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');

      queue.enqueue(
        { type: 'decode', id: 'test-2', buffer: new ArrayBuffer(8), format: 'jpeg' as any },
        TaskPriority.NORMAL,
        controller.signal,
      );

      queue.clear(new Error('pool disposed'));

      expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('does not leak listeners after 100 enqueue/dequeue cycles', () => {
      const queue = new TaskQueue();
      const controller = new AbortController();

      let addCount = 0;
      let removeCount = 0;

      const origAdd = controller.signal.addEventListener.bind(controller.signal);
      const origRemove = controller.signal.removeEventListener.bind(controller.signal);

      vi.spyOn(controller.signal, 'addEventListener').mockImplementation((...args: any[]) => {
        addCount++;
        return origAdd(...args);
      });
      vi.spyOn(controller.signal, 'removeEventListener').mockImplementation((...args: any[]) => {
        removeCount++;
        return origRemove(...args);
      });

      for (let i = 0; i < 100; i++) {
        queue.enqueue(
          { type: 'decode', id: `cycle-${i}`, buffer: new ArrayBuffer(8), format: 'jpeg' as any },
          TaskPriority.NORMAL,
          controller.signal,
        );
        queue.dequeue();
      }

      expect(addCount).toBe(100);
      expect(removeCount).toBe(100);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/workers/task-queue.test.ts`
Expected: FAIL — `removeEventListener` is never called.

- [ ] **Step 3: Implement abort listener cleanup**

In `src/workers/task-queue.ts`, update the `PendingTask` interface to store the listener reference, clean it up in `dequeue()` and `clear()`:

```typescript
// Add to PendingTask interface (after line 30):
export interface PendingTask {
  id: string;
  request: WorkerRequest;
  priority: TaskPriority;
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  abortListener?: () => void;
  enqueuedAt: number;
}
```

In `enqueue()`, replace the anonymous abort listener (lines 88-96) with a stored reference:

```typescript
      // Listen for abort
      if (signal) {
        const listener = () => {
          const index = this.tasks.indexOf(task);
          if (index !== -1) {
            this.tasks.splice(index, 1);
            reject(new Error('Task aborted while in queue'));
          }
        };
        signal.addEventListener('abort', listener);
        task.abortListener = listener;
      }
```

Add a private helper method to clean up the listener:

```typescript
  private cleanupAbortListener(task: PendingTask): void {
    if (task.abortListener && task.signal) {
      task.signal.removeEventListener('abort', task.abortListener);
      task.abortListener = undefined;
    }
  }
```

In `dequeue()`, call cleanup after shifting a valid task (inside the while loop, after `return this.tasks.shift()!`). Replace the while loop (lines 121-132):

```typescript
  dequeue(): PendingTask | null {
    if (this.tasks.length === 0) return null;

    // Skip and remove any aborted tasks
    while (this.tasks.length > 0) {
      const task = this.tasks[0];
      if (task.signal?.aborted) {
        this.tasks.shift();
        this.cleanupAbortListener(task);
        task.reject(new Error('Task aborted while in queue'));
        continue;
      }
      const dequeued = this.tasks.shift()!;
      this.cleanupAbortListener(dequeued);
      return dequeued;
    }

    return null;
  }
```

In `clear()`, add cleanup for each task (lines 137-143):

```typescript
  clear(error?: Error): void {
    const msg = error ?? new Error('Task queue cleared');
    for (const task of this.tasks) {
      this.cleanupAbortListener(task);
      task.reject(msg);
    }
    this.tasks.length = 0;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/workers/task-queue.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workers/task-queue.ts test/workers/task-queue.test.ts
git commit -m "fix: clean up abort listeners in TaskQueue to prevent memory leak"
```

---

### Task 2: Canvas Pool

**Files:**
- Create: `src/rendering/canvas-pool.ts`
- Create: `test/rendering/canvas-pool.test.ts`

Standalone new module with no dependencies on other fixes.

- [ ] **Step 1: Write the failing tests**

Create `test/rendering/canvas-pool.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CanvasPool } from '@/rendering/canvas-pool';

describe('CanvasPool', () => {
  let pool: CanvasPool;

  beforeEach(() => {
    pool = new CanvasPool(2);
  });

  it('creates a new canvas on first acquire', () => {
    const canvas = pool.acquire(100, 100);
    expect(canvas).toBeDefined();
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  it('reuses canvas when dimensions match', () => {
    const canvas1 = pool.acquire(200, 150);
    pool.release(canvas1);

    const canvas2 = pool.acquire(200, 150);
    expect(canvas2).toBe(canvas1);
  });

  it('creates new canvas when dimensions differ', () => {
    const canvas1 = pool.acquire(200, 150);
    pool.release(canvas1);

    const canvas2 = pool.acquire(300, 200);
    expect(canvas2).not.toBe(canvas1);
    expect(canvas2.width).toBe(300);
    expect(canvas2.height).toBe(200);
  });

  it('evicts oldest entry when pool is full', () => {
    const canvas1 = pool.acquire(100, 100);
    pool.release(canvas1);

    const canvas2 = pool.acquire(200, 200);
    pool.release(canvas2);

    // Pool is full (2 slots). Acquiring a third size evicts canvas1 (oldest).
    const canvas3 = pool.acquire(300, 300);
    pool.release(canvas3);

    // canvas2 should still be in pool
    const reused = pool.acquire(200, 200);
    expect(reused).toBe(canvas2);

    // canvas1 should have been evicted
    const fresh = pool.acquire(100, 100);
    expect(fresh).not.toBe(canvas1);
  });

  it('dispose clears all slots', () => {
    const canvas1 = pool.acquire(100, 100);
    pool.release(canvas1);

    pool.dispose();

    // After dispose, acquire returns a new canvas
    const canvas2 = pool.acquire(100, 100);
    expect(canvas2).not.toBe(canvas1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/rendering/canvas-pool.test.ts`
Expected: FAIL — module `@/rendering/canvas-pool` does not exist.

- [ ] **Step 3: Implement the canvas pool**

Create `src/rendering/canvas-pool.ts`:

```typescript
/**
 * CanvasPool — LRU pool of reusable temporary canvases.
 * Avoids repeated createElement('canvas') in rendering hot paths.
 */

interface PoolEntry {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  lastUsed: number;
}

export class CanvasPool {
  private readonly slots: PoolEntry[] = [];
  private readonly maxSlots: number;

  constructor(maxSlots: number = 2) {
    this.maxSlots = maxSlots;
  }

  /**
   * Get a canvas with the given dimensions.
   * Returns a pooled canvas if dimensions match, otherwise creates a new one.
   */
  acquire(width: number, height: number): HTMLCanvasElement {
    // Look for exact dimension match
    const matchIndex = this.slots.findIndex(
      (entry) => entry.width === width && entry.height === height,
    );

    if (matchIndex !== -1) {
      const entry = this.slots[matchIndex];
      this.slots.splice(matchIndex, 1);
      entry.lastUsed = Date.now();
      return entry.canvas;
    }

    // No match — create new canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Return a canvas to the pool for future reuse.
   */
  release(canvas: HTMLCanvasElement): void {
    // Evict oldest if at capacity
    if (this.slots.length >= this.maxSlots) {
      this.slots.sort((a, b) => a.lastUsed - b.lastUsed);
      this.slots.shift();
    }

    this.slots.push({
      canvas,
      width: canvas.width,
      height: canvas.height,
      lastUsed: Date.now(),
    });
  }

  /**
   * Clear all pooled canvases.
   */
  dispose(): void {
    this.slots.length = 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/rendering/canvas-pool.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rendering/canvas-pool.ts test/rendering/canvas-pool.test.ts
git commit -m "feat: add CanvasPool for reusable temporary canvases"
```

---

### Task 3: Integrate Canvas Pool into Renderer

**Files:**
- Modify: `src/rendering/canvas-renderer.ts`

Wire the pool into the existing rendering path. Depends on Task 2.

- [ ] **Step 1: Integrate canvas pool into renderToCanvas**

In `src/rendering/canvas-renderer.ts`, add the pool import and singleton, then use it in the temp canvas path.

Add import at top of file:

```typescript
import { CanvasPool } from './canvas-pool';

const tempCanvasPool = new CanvasPool(2);
```

Replace the temp canvas block (lines 50-57) with pooled version:

```typescript
  // For non-1:1 rendering, use a pooled temp canvas
  if (dims.width !== image.width || dims.height !== image.height) {
    const tempCanvas = tempCanvasPool.acquire(image.width, image.height);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(tempCanvas, dims.x, dims.y, dims.width, dims.height);
    tempCanvasPool.release(tempCanvas);
  } else {
    ctx.putImageData(imageData, dims.x, dims.y);
  }
```

- [ ] **Step 2: Run existing build to verify no regressions**

Run: `npx vue-tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/rendering/canvas-renderer.ts
git commit -m "perf: use canvas pool in renderToCanvas to avoid repeated allocations"
```

---

### Task 4: GPU-Accelerated EXIF Orientation

**Files:**
- Modify: `src/rendering/exif.ts`
- Create: `test/rendering/exif.test.ts`

- [ ] **Step 1: Write the failing tests for GPU-accelerated orientation**

Create `test/rendering/exif.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applyOrientation, readExifOrientation, type ExifOrientation } from '@/rendering/exif';

/**
 * Create a 4x4 test image with known pixel values.
 * Top-left = red, top-right = green, bottom-left = blue, bottom-right = white.
 * This pattern makes it easy to verify rotation/flip correctness.
 */
function createTestImage(): { data: Uint8ClampedArray; width: number; height: number } {
  const width = 4;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isTop = y < height / 2;
      const isLeft = x < width / 2;

      if (isTop && isLeft) {
        // Red
        data[idx] = 255; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255;
      } else if (isTop && !isLeft) {
        // Green
        data[idx] = 0; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255;
      } else if (!isTop && isLeft) {
        // Blue
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 255; data[idx + 3] = 255;
      } else {
        // White
        data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255;
      }
    }
  }

  return { data, width, height };
}

/** Get the RGBA at (x, y) as a tuple. */
function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number): [number, number, number, number] {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

describe('applyOrientation', () => {
  it('orientation 1 returns data unchanged', () => {
    const img = createTestImage();
    const result = applyOrientation(img.data, img.width, img.height, 1);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.data).toBe(img.data); // Same reference — no copy
  });

  it('orientation 2 flips horizontally', () => {
    const img = createTestImage();
    const result = applyOrientation(img.data, img.width, img.height, 2);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    // Top-left was red, after horizontal flip top-left should be green
    expect(getPixel(result.data, result.width, 0, 0)).toEqual([0, 255, 0, 255]);
    // Top-right should be red
    expect(getPixel(result.data, result.width, 3, 0)).toEqual([255, 0, 0, 255]);
  });

  it('orientation 3 rotates 180 degrees', () => {
    const img = createTestImage();
    const result = applyOrientation(img.data, img.width, img.height, 3);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    // Top-left was red, after 180° top-left should be white
    expect(getPixel(result.data, result.width, 0, 0)).toEqual([255, 255, 255, 255]);
    // Bottom-right should be red
    expect(getPixel(result.data, result.width, 3, 3)).toEqual([255, 0, 0, 255]);
  });

  it('orientation 6 rotates 90 CW — dimensions swap', () => {
    const img = createTestImage();
    const result = applyOrientation(img.data, img.width, img.height, 6);
    expect(result.width).toBe(4); // height becomes width
    expect(result.height).toBe(4); // width becomes height (square, so same)
    // Top-left was red, after 90° CW top-left should be blue
    expect(getPixel(result.data, result.width, 0, 0)).toEqual([0, 0, 255, 255]);
  });

  it('orientation 8 rotates 90 CCW — dimensions swap', () => {
    const img = createTestImage();
    const result = applyOrientation(img.data, img.width, img.height, 8);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    // Top-left was red, after 90° CCW top-left should be green
    expect(getPixel(result.data, result.width, 0, 0)).toEqual([0, 255, 0, 255]);
  });

  it('handles non-square images with dimension swap (orientation 6)', () => {
    // 6x4 image
    const width = 6;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    // Fill with a recognizable pattern
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128; data[i + 1] = 64; data[i + 2] = 32; data[i + 3] = 255;
    }

    const result = applyOrientation(data, width, height, 6);
    // Dimensions should swap: 6x4 → 4x6
    expect(result.width).toBe(height); // 4
    expect(result.height).toBe(width); // 6
    expect(result.data.length).toBe(width * height * 4);
  });
});

describe('readExifOrientation', () => {
  it('returns 1 for non-JPEG data', () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47]).buffer;
    expect(readExifOrientation(pngHeader)).toBe(1);
  });

  it('returns 1 for empty buffer', () => {
    expect(readExifOrientation(new ArrayBuffer(0))).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass with current pixel-by-pixel implementation**

Run: `npx vitest run test/rendering/exif.test.ts`
Expected: All tests PASS (these test the interface, not the implementation).

This is a refactor task — tests validate correctness of the existing implementation first, then we swap internals.

- [ ] **Step 3: Add GPU-accelerated implementation**

In `src/rendering/exif.ts`, add the new `applyOrientationViaCanvas` function after the existing `applyOrientation`. Then update `applyOrientation` to delegate to it when `OffscreenCanvas` is available.

Add import at top of file:

```typescript
import { hasOffscreenCanvas } from '../utils/ssr';
```

Replace the `applyOrientation` function body (lines 115-156) with:

```typescript
export function applyOrientation(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  orientation: ExifOrientation,
): { data: Uint8ClampedArray; width: number; height: number } {
  if (orientation === 1) {
    return { data, width, height };
  }

  if (hasOffscreenCanvas()) {
    return applyOrientationViaCanvas(data, width, height, orientation);
  }

  return applyOrientationPixelByPixel(data, width, height, orientation);
}

/**
 * GPU-accelerated orientation using OffscreenCanvas transforms.
 * drawImage respects the transform matrix — GPU compositing.
 */
function applyOrientationViaCanvas(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  orientation: ExifOrientation,
): { data: Uint8ClampedArray; width: number; height: number } {
  // Source canvas with original pixels
  const srcCanvas = new OffscreenCanvas(width, height);
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.putImageData(new ImageData(data, width, height), 0, 0);

  // Output dimensions (swapped for orientations 5-8)
  const swapDimensions = orientation >= 5;
  const outWidth = swapDimensions ? height : width;
  const outHeight = swapDimensions ? width : height;

  const outCanvas = new OffscreenCanvas(outWidth, outHeight);
  const outCtx = outCanvas.getContext('2d')!;

  // Apply orientation transform
  switch (orientation) {
    case 2:
      outCtx.translate(outWidth, 0);
      outCtx.scale(-1, 1);
      break;
    case 3:
      outCtx.translate(outWidth, outHeight);
      outCtx.scale(-1, -1);
      break;
    case 4:
      outCtx.translate(0, outHeight);
      outCtx.scale(1, -1);
      break;
    case 5:
      outCtx.translate(0, 0);
      outCtx.rotate(Math.PI / 2);
      outCtx.scale(1, -1);
      break;
    case 6:
      outCtx.translate(outWidth, 0);
      outCtx.rotate(Math.PI / 2);
      break;
    case 7:
      outCtx.translate(outWidth, outHeight);
      outCtx.rotate(Math.PI / 2);
      outCtx.scale(-1, 1);
      break;
    case 8:
      outCtx.translate(0, outHeight);
      outCtx.rotate(-Math.PI / 2);
      break;
  }

  outCtx.drawImage(srcCanvas, 0, 0);

  return {
    data: outCtx.getImageData(0, 0, outWidth, outHeight).data,
    width: outWidth,
    height: outHeight,
  };
}

/**
 * Pixel-by-pixel fallback for environments without OffscreenCanvas.
 */
function applyOrientationPixelByPixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  orientation: ExifOrientation,
): { data: Uint8ClampedArray; width: number; height: number } {
  const swapDimensions = orientation >= 5;
  const outWidth = swapDimensions ? height : width;
  const outHeight = swapDimensions ? width : height;
  const result = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      let dstX: number, dstY: number;

      switch (orientation) {
        case 2: dstX = width - 1 - x; dstY = y; break;
        case 3: dstX = width - 1 - x; dstY = height - 1 - y; break;
        case 4: dstX = x; dstY = height - 1 - y; break;
        case 5: dstX = y; dstY = x; break;
        case 6: dstX = height - 1 - y; dstY = x; break;
        case 7: dstX = height - 1 - y; dstY = width - 1 - x; break;
        case 8: dstX = y; dstY = width - 1 - x; break;
        default: dstX = x; dstY = y;
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
```

- [ ] **Step 4: Run tests to verify they still pass**

Run: `npx vitest run test/rendering/exif.test.ts`
Expected: All tests PASS. jsdom may not have OffscreenCanvas, so the pixel-by-pixel fallback runs. Both paths produce the same output, so tests validate correctness either way.

- [ ] **Step 5: Commit**

```bash
git add src/rendering/exif.ts test/rendering/exif.test.ts
git commit -m "perf: GPU-accelerated EXIF orientation via OffscreenCanvas with pixel-by-pixel fallback"
```

---

### Task 5: Add `bitmap` Field to DecodedImage Type

**Files:**
- Modify: `src/types/image.ts`

Small type change that Task 6 depends on.

- [ ] **Step 1: Add optional bitmap field to DecodedImage**

In `src/types/image.ts`, add the `bitmap` field to the `DecodedImage` interface (after line 49, before `dispose()`):

```typescript
  /**
   * Optional live ImageBitmap from native decode path.
   * When present, renderers can use drawImage(bitmap) for GPU-accelerated rendering
   * instead of going through putImageData.
   */
  readonly bitmap?: ImageBitmap;
```

- [ ] **Step 2: Verify type check passes**

Run: `npx vue-tsc --noEmit`
Expected: No errors — bitmap is optional so existing code is unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/types/image.ts
git commit -m "feat: add optional bitmap field to DecodedImage for GPU rendering path"
```

---

### Task 6: Keep ImageBitmap Alive in NativeCodec + Bitmap Fast Path in Renderer

**Files:**
- Modify: `src/codecs/native-codec.ts`
- Modify: `src/rendering/canvas-renderer.ts`
- Create: `test/codecs/native-codec.test.ts`

Depends on Task 5 (bitmap type) and Task 3 (canvas pool in renderer).

- [ ] **Step 1: Write tests for lazy bitmap behavior**

Create `test/codecs/native-codec.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('NativeCodec with lazy bitmap', () => {
  it('returns a DecodedImage with bitmap field set', async () => {
    // In jsdom, createImageBitmap may not exist — test the structural contract
    // by mocking the necessary browser APIs

    const mockBitmap = {
      width: 100,
      height: 100,
      close: vi.fn(),
    } as unknown as ImageBitmap;

    const mockImageData = {
      data: new Uint8ClampedArray(100 * 100 * 4),
      width: 100,
      height: 100,
    };

    // Mock global createImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap));
    vi.stubGlobal('OffscreenCanvas', vi.fn().mockImplementation((w: number, h: number) => ({
      width: w,
      height: h,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => mockImageData,
      }),
    })));

    const { NativeCodec } = await import('@/codecs/native-codec');
    const codec = new NativeCodec();
    const buffer = new ArrayBuffer(8);

    const result = await codec.decode(buffer);

    expect(result.bitmap).toBeDefined();
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.decodePath).toBe('native');
  });

  it('dispose closes the bitmap', async () => {
    const closeFn = vi.fn();
    const mockBitmap = {
      width: 50,
      height: 50,
      close: closeFn,
    } as unknown as ImageBitmap;

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap));
    vi.stubGlobal('OffscreenCanvas', vi.fn().mockImplementation((w: number, h: number) => ({
      width: w,
      height: h,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
      }),
    })));

    const { NativeCodec } = await import('@/codecs/native-codec');
    const codec = new NativeCodec();

    const result = await codec.decode(new ArrayBuffer(8));
    result.dispose();

    expect(closeFn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/codecs/native-codec.test.ts`
Expected: FAIL — `result.bitmap` is undefined (not set in current implementation).

- [ ] **Step 3: Modify NativeCodec to keep ImageBitmap alive**

In `src/codecs/native-codec.ts`, replace the `decode` method (lines 35-90) and `readPixels` method:

```typescript
  async decode(buffer: ArrayBuffer, options?: DecodeOptions): Promise<DecodedImage> {
    if (!hasCreateImageBitmap()) {
      throw new CodecError(
        ErrorCodes.DECODE_FAILED,
        'createImageBitmap is not available',
      );
    }

    const blob = new Blob([buffer]);

    try {
      const bitmap = await createImageBitmap(blob);

      // Guard against 0x0 bitmaps (WebView edge case)
      if (bitmap.width === 0 || bitmap.height === 0) {
        bitmap.close();
        throw new CodecError(
          ErrorCodes.DECODE_FAILED,
          `Native decode returned 0x0 bitmap`,
        );
      }

      const width = bitmap.width;
      const height = bitmap.height;

      // Lazy RGBA data — only read pixels when accessed
      let pixelData: Uint8ClampedArray | null = null;
      let disposed = false;

      const decoded: DecodedImage = {
        get data(): Uint8ClampedArray {
          if (disposed) {
            throw new CodecError(
              ErrorCodes.DECODE_FAILED,
              'Cannot access pixel data after dispose',
            );
          }
          if (!pixelData) {
            pixelData = readPixelsFromBitmap(bitmap, width, height);
          }
          return pixelData;
        },
        width,
        height,
        format: Format.Unknown, // Caller sets this
        orientation: 1,
        decodePath: 'native',
        bitmap,
        dispose() {
          if (disposed) return;
          disposed = true;
          bitmap.close();
          pixelData = null;
        },
      };

      return decoded;
    } catch (error) {
      if (error instanceof CodecError) throw error;

      const codecError = new CodecError(
        ErrorCodes.NATIVE_DECODE_FAILED,
        `Native decode failed: ${(error as Error).message}`,
        error,
      );

      this.onDecodeFailure?.(Format.Unknown, codecError);
      throw codecError;
    }
  }
```

Remove the `readPixels` private method and add a module-level helper instead (replacing lines 95-112):

```typescript
/**
 * Read RGBA pixel data from an ImageBitmap.
 */
function readPixelsFromBitmap(bitmap: ImageBitmap, width: number, height: number): Uint8ClampedArray {
  if (hasOffscreenCanvas()) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  }

  // Fallback: regular canvas (main thread only)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, width, height).data;
}
```

- [ ] **Step 4: Add bitmap fast path to canvas-renderer**

In `src/rendering/canvas-renderer.ts`, add a bitmap check before the ImageData path. Replace the section after the background fill (lines 43-60):

```typescript
  // Fast path: if decoded image has a live ImageBitmap, use drawImage directly
  if (image.bitmap) {
    const dims = calculateFitDimensions(image.width, image.height, width, height, fit);
    ctx.drawImage(image.bitmap, dims.x, dims.y, dims.width, dims.height);
    return;
  }

  // Create ImageData from decoded RGBA
  const imageData = new ImageData((image.data as any), image.width, image.height);

  // Calculate fit dimensions
  const dims = calculateFitDimensions(image.width, image.height, width, height, fit);

  // For non-1:1 rendering, use a pooled temp canvas
  if (dims.width !== image.width || dims.height !== image.height) {
    const tempCanvas = tempCanvasPool.acquire(image.width, image.height);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(tempCanvas, dims.x, dims.y, dims.width, dims.height);
    tempCanvasPool.release(tempCanvas);
  } else {
    ctx.putImageData(imageData, dims.x, dims.y);
  }
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/codecs/native-codec.test.ts`
Expected: All tests PASS.

Run: `npx vue-tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/codecs/native-codec.ts src/rendering/canvas-renderer.ts test/codecs/native-codec.test.ts
git commit -m "perf: keep ImageBitmap alive for GPU rendering, lazy RGBA readback"
```

---

### Task 7: Replace toDataURL with toBlobURL in UniversalImage

**Files:**
- Modify: `src/vue/UniversalImage.vue`
- Create: `test/rendering/bitmap-renderer.test.ts`

- [ ] **Step 1: Write test for toBlobURL correctness**

Create `test/rendering/bitmap-renderer.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { toBlobURL, toDataURL } from '@/rendering/bitmap-renderer';
import type { DecodedImage } from '@/types/image';

function createMockImage(width = 2, height = 2): DecodedImage {
  return {
    data: new Uint8ClampedArray(width * height * 4).fill(128),
    width,
    height,
    format: 'jpeg' as any,
    orientation: 1,
    decodePath: 'wasm',
    dispose: vi.fn(),
  };
}

describe('toDataURL', () => {
  it('returns a data URL string', () => {
    const image = createMockImage();
    const url = toDataURL(image);
    expect(url).toMatch(/^data:image\/png;base64,/);
  });
});

describe('toBlobURL', () => {
  it('returns a blob: URL string', async () => {
    const image = createMockImage();
    const url = await toBlobURL(image);
    expect(url).toMatch(/^blob:/);
    URL.revokeObjectURL(url);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run test/rendering/bitmap-renderer.test.ts`
Expected: PASS (both functions already work — this validates them before we change the consumer).

- [ ] **Step 3: Update UniversalImage to use toBlobURL**

In `src/vue/UniversalImage.vue`, modify the `<script setup>` section:

Replace the `watch(decoded, ...)` block (lines 71-91) with:

```typescript
// Track blob URL for cleanup
let currentBlobUrl: string | null = null;

function revokePreviousBlobUrl(): void {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
}

// When decoded, create a blob URL for <img> rendering
watch(decoded, async (image) => {
  if (!image) {
    revokePreviousBlobUrl();
    imgSrc.value = null;
    return;
  }

  try {
    revokePreviousBlobUrl();
    const blobUrl = await toBlobURL(image);
    // Check if component is still showing the same image (avoid race)
    if (decoded.value === image) {
      currentBlobUrl = blobUrl;
      imgSrc.value = blobUrl;
      emit('load', { format: format.value, width: image.width, height: image.height });
    } else {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (err) {
    // Fallback to canvas rendering if blob URL fails
    if (canvasRef.value) {
      const renderOptions: RenderOptions = {
        fit: props.fit,
        background: props.background,
      };
      renderImage(canvasRef.value, image, renderOptions);
    }
  }
});
```

Update the import at line 12 — change `toDataURL` to `toBlobURL`:

```typescript
import { toBlobURL } from '../rendering/bitmap-renderer';
```

Add cleanup in `onBeforeUnmount`:

```typescript
onBeforeUnmount(() => {
  revokePreviousBlobUrl();
});
```

Note: The existing `onBeforeUnmount` at line 119 handles the IntersectionObserver. Add the blob cleanup either beside it or in a separate `onBeforeUnmount` call (Vue supports multiple).

- [ ] **Step 4: Verify type check**

Run: `npx vue-tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/vue/UniversalImage.vue test/rendering/bitmap-renderer.test.ts
git commit -m "perf: use toBlobURL instead of toDataURL in UniversalImage for async rendering"
```

---

### Task 8: Forward maxDimension to WASM Worker

**Files:**
- Modify: `src/types/worker.ts`
- Modify: `src/engine/loader.ts`
- Modify: `src/workers/decode-worker.ts`

- [ ] **Step 1: Add maxDimension to WorkerDecodeRequest type**

In `src/types/worker.ts`, add `maxDimension` to `WorkerDecodeRequest` (after line 26):

```typescript
export interface WorkerDecodeRequest {
  type: 'decode';
  /** Unique request ID for correlating responses */
  id: string;
  /** Raw image bytes (transferred, not copied) */
  buffer: ArrayBuffer;
  /** Pre-detected format (avoids re-detection in worker) */
  format: ImageFormat;
  /** Decode options */
  options?: DecodeOptions;
  /** Max dimension for post-decode downsample */
  maxDimension?: number;
}
```

- [ ] **Step 2: Forward maxDimension in loader**

In `src/engine/loader.ts`, update `decodeViaWorker()` to pass `maxDimension`. Replace the pool.submit call (lines 238-247):

```typescript
  const response: WorkerResponse = await pool.submit(
    {
      type: 'decode',
      id,
      buffer,
      format,
      maxDimension: _options?.maxDimension,
    },
    TaskPriority.HIGH,
    signal,
  );
```

- [ ] **Step 3: Implement post-decode downsample in worker**

In `src/workers/decode-worker.ts`, add a downsample step after decode in `handleDecode()`. Import the scaler utility:

Add import at top:

```typescript
import { scaleDimensions } from '../rendering/scaler';
```

Replace the success path in `handleDecode()` (lines 138-145) with:

```typescript
    let decoded: DecodedImage = await codec.decode(buffer, options);

    // Post-decode downsample if maxDimension is set
    if (maxDimension && (decoded.width > maxDimension || decoded.height > maxDimension)) {
      decoded = downsampleInWorker(decoded, maxDimension);
    }

    const { data: transferable, transfer } = toTransferable(decoded);

    // Use postMessage with transfer list for zero-copy
    (self as any).postMessage(
      { type: 'decode-result', id, image: transferable } satisfies WorkerResponse,
      transfer,
    );
```

Add the `maxDimension` parameter to `handleDecode` signature:

```typescript
async function handleDecode(
  id: string,
  buffer: ArrayBuffer,
  format: ImageFormat,
  options?: DecodeOptions,
  maxDimension?: number,
): Promise<void> {
```

Update the message handler call (line 96) to pass `maxDimension`:

```typescript
    case 'decode':
      await handleDecode(request.id, request.buffer, request.format, request.options, request.maxDimension);
      break;
```

Add the downsample helper at the bottom of the file:

```typescript
/**
 * Downsample decoded image in the worker thread before transferring.
 * Uses OffscreenCanvas for GPU-accelerated scaling.
 */
function downsampleInWorker(image: DecodedImage, maxDimension: number): DecodedImage {
  const scaled = scaleDimensions(image.width, image.height, maxDimension);

  if (scaled.scale >= 1) return image; // No downscaling needed

  try {
    // Source canvas
    const srcCanvas = new OffscreenCanvas(image.width, image.height);
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.putImageData(new ImageData(image.data as any, image.width, image.height), 0, 0);

    // Scaled canvas
    const dstCanvas = new OffscreenCanvas(scaled.width, scaled.height);
    const dstCtx = dstCanvas.getContext('2d')!;
    dstCtx.drawImage(srcCanvas, 0, 0, scaled.width, scaled.height);

    const downsampled = dstCtx.getImageData(0, 0, scaled.width, scaled.height);

    let disposed = false;
    return {
      data: downsampled.data,
      width: scaled.width,
      height: scaled.height,
      format: image.format,
      orientation: image.orientation,
      decodePath: image.decodePath,
      dispose() {
        if (disposed) return;
        disposed = true;
      },
    };
  } catch {
    // If OffscreenCanvas fails in worker, return full-resolution
    return image;
  }
}
```

- [ ] **Step 4: Verify type check**

Run: `npx vue-tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/worker.ts src/engine/loader.ts src/workers/decode-worker.ts
git commit -m "perf: forward maxDimension to worker for post-decode downsampling"
```

---

### Task 9: Codec Pre-warming (warmup API)

**Files:**
- Modify: `src/workers/pool.ts`
- Modify: `src/engine/loader.ts`
- Modify: `src/index.ts`
- Create: `test/engine/loader.test.ts`

- [ ] **Step 1: Write the failing test for warmup**

Create `test/engine/loader.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('warmup', () => {
  it('is exported from the public API', async () => {
    const api = await import('@/index');
    expect(api.warmup).toBeDefined();
    expect(typeof api.warmup).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/loader.test.ts`
Expected: FAIL — `warmup` is not exported.

- [ ] **Step 3: Add warmup method to WorkerPool**

In `src/workers/pool.ts`, add a `warmup` method after the `submit` method:

```typescript
  /**
   * Pre-initialize codecs for the given formats.
   * Sends init-codec messages to workers at low priority.
   * Non-fatal — failures are silently ignored.
   */
  async warmup(formats: readonly ImageFormat[]): Promise<void> {
    if (this.disposed || !hasWorkerSupport()) return;

    const promises = formats.map((format) => {
      const id = `warmup-${format}-${Date.now()}`;
      return this.submit(
        { type: 'init-codec', id, format },
        TaskPriority.LOW,
      ).catch(() => {
        // Warmup failures are non-fatal
      });
    });

    await Promise.all(promises);
  }
```

Add the `ImageFormat` import at the top of `pool.ts`:

```typescript
import type { ImageFormat } from '../types/image';
```

- [ ] **Step 4: Add warmup function to loader**

In `src/engine/loader.ts`, add the `warmup` function after `disposeEngine()`:

```typescript
/**
 * Pre-initialize WASM codecs for the given formats.
 * Call early (e.g., on app mount) to avoid cold-start latency on first decode.
 * Non-fatal — if warmup fails, the first decode pays the init cost (current behavior).
 */
export async function warmup(formats: ImageFormat[]): Promise<void> {
  if (!hasWorkerSupport()) return;

  const pool = getWorkerPool();
  await pool.warmup(formats);
}
```

Add `ImageFormat` to the existing import from `'../types/image'` if not already imported as a value (it's already imported as `Format`). The function uses the `ImageFormat` type for its parameter — use the array type directly:

```typescript
import { ImageFormat as Format, UNIVERSALLY_SUPPORTED_FORMATS, type ImageFormat } from '../types/image';
```

Wait — `ImageFormat` is already imported as the enum `Format`. The parameter type should just use `ImageFormat` from the types. Since we already have `import type { ImageFormat } from '../types/image'` on line 13 and the enum imported as `Format` on line 15, we can use `ImageFormat` directly as the parameter type. Actually looking at the imports:

Line 13: `import type { DecodedImage, ImageFormat } from '../types/image';`
Line 15: `import { ImageFormat as Format, UNIVERSALLY_SUPPORTED_FORMATS } from '../types/image';`

`ImageFormat` is available as a type from line 13. Use it directly in the parameter.

- [ ] **Step 5: Export warmup from index.ts**

In `src/index.ts`, update the core functions export (line 10):

```typescript
export { loadImage, disposeEngine, warmup } from './engine/loader';
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run test/engine/loader.test.ts`
Expected: PASS.

Run: `npx vue-tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/workers/pool.ts src/engine/loader.ts src/index.ts test/engine/loader.test.ts
git commit -m "feat: add warmup() API for pre-initializing WASM codecs"
```

---

### Task 10: Final Type Check and Full Test Suite

**Files:** None — verification only.

- [ ] **Step 1: Run full type check**

Run: `npx vue-tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Run build**

Run: `npm run build:lib`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any remaining changes**

If any fixes were needed in steps 1-3, commit them:

```bash
git add -A
git commit -m "chore: fix issues found during final verification"
```
