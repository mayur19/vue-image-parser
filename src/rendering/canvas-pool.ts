/**
 * CanvasPool — LRU pool of reusable temporary canvases.
 * Avoids repeated createElement('canvas') in rendering hot paths.
 */

interface PoolEntry {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly lastUsed: number;
}

export class CanvasPool {
  private slots: PoolEntry[];
  private readonly maxSlots: number;

  constructor(maxSlots: number = 2) {
    this.maxSlots = maxSlots;
    this.slots = [];
  }

  /**
   * Returns a canvas with the exact dimensions requested.
   * Reuses a pooled canvas if one matches; otherwise creates a new one.
   */
  acquire(width: number, height: number): HTMLCanvasElement {
    const matchIndex = this.slots.findIndex(
      (entry) => entry.width === width && entry.height === height,
    );

    if (matchIndex !== -1) {
      const [entry] = this.slots.splice(matchIndex, 1);
      return entry.canvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Returns a canvas to the pool for future reuse.
   * Evicts the oldest entry when the pool is at capacity.
   */
  release(canvas: HTMLCanvasElement): void {
    // Guard against double-release of the same canvas
    if (this.slots.some(e => e.canvas === canvas)) return;

    if (this.slots.length >= this.maxSlots) {
      // Entries are appended in order, so oldest is always at index 0
      this.slots = this.slots.slice(1);
    }

    this.slots = [
      ...this.slots,
      { canvas, width: canvas.width, height: canvas.height, lastUsed: Date.now() },
    ];
  }

  /**
   * Clears all pooled canvases.
   */
  dispose(): void {
    this.slots = [];
  }
}
