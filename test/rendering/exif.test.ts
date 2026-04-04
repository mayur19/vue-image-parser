import { describe, it, expect } from 'vitest';
import { applyOrientation, readExifOrientation } from '@/rendering/exif';
import type { ExifOrientation } from '@/rendering/exif';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RED   = [255,   0,   0, 255] as const;
const GREEN = [  0, 255,   0, 255] as const;
const BLUE  = [  0,   0, 255, 255] as const;
const WHITE = [255, 255, 255, 255] as const;

type RGBA = readonly [number, number, number, number];

/**
 * Build a 4×4 RGBA image with four quadrants:
 *   top-left=RED, top-right=GREEN, bottom-left=BLUE, bottom-right=WHITE
 *
 * Layout (each cell is 2×2 pixels):
 *   R R G G
 *   R R G G
 *   B B W W
 *   B B W W
 */
function makeTestImage(width = 4, height = 4): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const halfW = Math.floor(width / 2);
      const halfH = Math.floor(height / 2);
      const left  = x < halfW;
      const top   = y < halfH;

      const color: RGBA =
        top  && left  ? RED   :
        top  && !left ? GREEN :
        !top && left  ? BLUE  :
        WHITE;

      const idx = (y * width + x) * 4;
      data[idx]     = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = color[3];
    }
  }

  return data;
}

/** Read RGBA tuple at pixel (x, y) in a width×? image. */
function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number): RGBA {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

/** Check that two RGBA values are equal. */
function colorEq(a: RGBA, b: RGBA): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

// ---------------------------------------------------------------------------
// applyOrientation
// ---------------------------------------------------------------------------

describe('applyOrientation', () => {
  it('orientation 1: returns the same data reference unchanged', () => {
    const data = makeTestImage();
    const result = applyOrientation(data, 4, 4, 1);
    expect(result.data).toBe(data);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });

  it('orientation 2: flips horizontally — top-left becomes green', () => {
    const data = makeTestImage();
    const { data: out, width } = applyOrientation(data, 4, 4, 2);
    // Original top-right (GREEN) should now be at top-left
    expect(colorEq(pixelAt(out, width, 0, 0), GREEN)).toBe(true);
    // Original top-left (RED) should now be at top-right
    expect(colorEq(pixelAt(out, width, 3, 0), RED)).toBe(true);
    // Bottom corners
    expect(colorEq(pixelAt(out, width, 0, 3), WHITE)).toBe(true);
    expect(colorEq(pixelAt(out, width, 3, 3), BLUE)).toBe(true);
  });

  it('orientation 3: rotates 180° — top-left becomes white', () => {
    const data = makeTestImage();
    const { data: out, width } = applyOrientation(data, 4, 4, 3);
    // Original bottom-right (WHITE) maps to top-left after 180°
    expect(colorEq(pixelAt(out, width, 0, 0), WHITE)).toBe(true);
    // Original bottom-left (BLUE) maps to top-right
    expect(colorEq(pixelAt(out, width, 3, 0), BLUE)).toBe(true);
    // Original top-right (GREEN) maps to bottom-left
    expect(colorEq(pixelAt(out, width, 0, 3), GREEN)).toBe(true);
    // Original top-left (RED) maps to bottom-right
    expect(colorEq(pixelAt(out, width, 3, 3), RED)).toBe(true);
  });

  it('orientation 4: flips vertically — top-left becomes blue', () => {
    const data = makeTestImage();
    const { data: out, width } = applyOrientation(data, 4, 4, 4);
    expect(colorEq(pixelAt(out, width, 0, 0), BLUE)).toBe(true);
    expect(colorEq(pixelAt(out, width, 3, 0), WHITE)).toBe(true);
    expect(colorEq(pixelAt(out, width, 0, 3), RED)).toBe(true);
    expect(colorEq(pixelAt(out, width, 3, 3), GREEN)).toBe(true);
  });

  it('orientation 6: rotates 90° CW — top-left becomes blue', () => {
    const data = makeTestImage();
    const { data: out, width, height } = applyOrientation(data, 4, 4, 6);
    // dimensions stay 4×4 for a square image
    expect(width).toBe(4);
    expect(height).toBe(4);
    // 90° CW: new top-left comes from original bottom-left (BLUE)
    expect(colorEq(pixelAt(out, width, 0, 0), BLUE)).toBe(true);
    // new top-right comes from original top-left (RED)
    expect(colorEq(pixelAt(out, width, 3, 0), RED)).toBe(true);
    // new bottom-left comes from original bottom-right (WHITE)
    expect(colorEq(pixelAt(out, width, 0, 3), WHITE)).toBe(true);
    // new bottom-right comes from original top-right (GREEN)
    expect(colorEq(pixelAt(out, width, 3, 3), GREEN)).toBe(true);
  });

  it('orientation 8: rotates 90° CCW — top-left becomes green', () => {
    const data = makeTestImage();
    const { data: out, width, height } = applyOrientation(data, 4, 4, 8);
    expect(width).toBe(4);
    expect(height).toBe(4);
    // 90° CCW: new top-left comes from original top-right (GREEN)
    expect(colorEq(pixelAt(out, width, 0, 0), GREEN)).toBe(true);
    // new top-right comes from original bottom-right (WHITE)
    expect(colorEq(pixelAt(out, width, 3, 0), WHITE)).toBe(true);
    // new bottom-left comes from original top-left (RED)
    expect(colorEq(pixelAt(out, width, 0, 3), RED)).toBe(true);
    // new bottom-right comes from original bottom-left (BLUE)
    expect(colorEq(pixelAt(out, width, 3, 3), BLUE)).toBe(true);
  });

  it('orientation 5: transpose — all four corners', () => {
    const data = makeTestImage();
    const { data: out, width, height } = applyOrientation(data, 4, 4, 5);
    expect(width).toBe(4);
    expect(height).toBe(4);
    // orientation 5 maps (x,y) → (dstX=y, dstY=x) — a pure transpose
    // top-left of output comes from source (0,0) = RED
    expect(colorEq(pixelAt(out, width, 0, 0), RED)).toBe(true);
    // top-right of output comes from source (0,3) = BLUE
    expect(colorEq(pixelAt(out, width, 3, 0), BLUE)).toBe(true);
    // bottom-left of output comes from source (3,0) = GREEN
    expect(colorEq(pixelAt(out, width, 0, 3), GREEN)).toBe(true);
    // bottom-right of output comes from source (3,3) = WHITE
    expect(colorEq(pixelAt(out, width, 3, 3), WHITE)).toBe(true);
  });

  it('orientation 7: all four corners', () => {
    const data = makeTestImage();
    const { data: out, width, height } = applyOrientation(data, 4, 4, 7);
    expect(width).toBe(4);
    expect(height).toBe(4);
    // orientation 7 maps (x,y) → (dstX=height-1-y, dstY=width-1-x)
    // top-left of output comes from source (3,3) = WHITE
    expect(colorEq(pixelAt(out, width, 0, 0), WHITE)).toBe(true);
    // top-right of output comes from source (3,0) = GREEN
    expect(colorEq(pixelAt(out, width, 3, 0), GREEN)).toBe(true);
    // bottom-left of output comes from source (0,3) = BLUE
    expect(colorEq(pixelAt(out, width, 0, 3), BLUE)).toBe(true);
    // bottom-right of output comes from source (0,0) = RED
    expect(colorEq(pixelAt(out, width, 3, 3), RED)).toBe(true);
  });

  it('non-square image with orientation 6 swaps dimensions (6×4 → 4×6)', () => {
    // Build a 6-wide × 4-tall image
    const data = makeTestImage(6, 4);
    const { width, height } = applyOrientation(data, 6, 4, 6);
    expect(width).toBe(4);
    expect(height).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// readExifOrientation
// ---------------------------------------------------------------------------

describe('readExifOrientation', () => {
  it('returns 1 for an empty buffer', () => {
    const buf = new ArrayBuffer(0);
    expect(readExifOrientation(buf)).toBe(1);
  });

  it('returns 1 for a non-JPEG buffer', () => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, 0x89504E47); // PNG magic
    expect(readExifOrientation(buf)).toBe(1);
  });

  it('returns 1 for a JPEG with no APP1 EXIF segment', () => {
    // Minimal JPEG: SOI marker only
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint16(0, 0xFFD8);
    expect(readExifOrientation(buf)).toBe(1);
  });
});
