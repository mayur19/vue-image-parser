import { describe, it, expect } from 'vitest';
import { scaleDimensions, calculateFitDimensions } from '../../src/rendering/scaler';

describe('scaleDimensions', () => {
  it('returns original dimensions with scale 1 when both are within max', () => {
    const result = scaleDimensions(800, 600, 1024);
    expect(result).toEqual({ width: 800, height: 600, scale: 1 });
  });

  it('returns original dimensions when exactly at max', () => {
    const result = scaleDimensions(1024, 1024, 1024);
    expect(result).toEqual({ width: 1024, height: 1024, scale: 1 });
  });

  it('scales down when width exceeds max, preserving aspect ratio', () => {
    const result = scaleDimensions(2000, 1000, 1000);
    expect(result.width).toBe(1000);
    expect(result.height).toBe(500);
    expect(result.scale).toBeCloseTo(0.5);
    // Aspect ratio preserved: 2000/1000 === 1000/500
    expect(result.width / result.height).toBeCloseTo(2000 / 1000);
  });

  it('scales down when height exceeds max, preserving aspect ratio', () => {
    const result = scaleDimensions(500, 2000, 1000);
    expect(result.width).toBe(250);
    expect(result.height).toBe(1000);
    expect(result.scale).toBeCloseTo(0.5);
    expect(result.width / result.height).toBeCloseTo(500 / 2000);
  });

  it('scales to fit the larger dimension when both exceed max', () => {
    const result = scaleDimensions(3000, 2000, 1500);
    // Scale is determined by the larger dimension (3000)
    expect(result.scale).toBeCloseTo(1500 / 3000);
    expect(result.width).toBe(1500);
    expect(result.height).toBe(1000);
    expect(result.width).toBeLessThanOrEqual(1500);
    expect(result.height).toBeLessThanOrEqual(1500);
  });

  it('scales a square image exceeding max', () => {
    const result = scaleDimensions(2000, 2000, 500);
    expect(result.width).toBe(500);
    expect(result.height).toBe(500);
    expect(result.scale).toBeCloseTo(0.25);
  });

  it('handles a very small max dimension of 1', () => {
    const result = scaleDimensions(1920, 1080, 1);
    expect(result.scale).toBeCloseTo(1 / 1920);
    expect(result.width).toBe(1);
    expect(result.height).toBe(Math.round(1080 * (1 / 1920)));
    expect(result.width).toBeLessThanOrEqual(1);
    expect(result.height).toBeLessThanOrEqual(1);
  });

  it('does not scale up small images', () => {
    const result = scaleDimensions(50, 30, 1000);
    expect(result).toEqual({ width: 50, height: 30, scale: 1 });
  });
});

describe('calculateFitDimensions', () => {
  describe('fill', () => {
    it('always fills the container exactly, ignoring source aspect ratio', () => {
      const result = calculateFitDimensions(800, 600, 400, 300, 'fill');
      expect(result).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    });

    it('fills even when source is smaller than container', () => {
      const result = calculateFitDimensions(100, 50, 400, 300, 'fill');
      expect(result).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    });

    it('fills a square container from a non-square source', () => {
      const result = calculateFitDimensions(1920, 1080, 500, 500, 'fill');
      expect(result).toEqual({ x: 0, y: 0, width: 500, height: 500 });
    });
  });

  describe('none', () => {
    it('centers the image at its original size', () => {
      const result = calculateFitDimensions(200, 100, 400, 300, 'none');
      expect(result).toEqual({
        x: (400 - 200) / 2,
        y: (300 - 100) / 2,
        width: 200,
        height: 100,
      });
    });

    it('centers a larger image (may overflow container)', () => {
      const result = calculateFitDimensions(800, 600, 400, 300, 'none');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      // Negative offsets indicate overflow
      expect(result.x).toBe((400 - 800) / 2);
      expect(result.y).toBe((300 - 600) / 2);
      expect(result.x).toBeLessThan(0);
      expect(result.y).toBeLessThan(0);
    });

    it('centers an image that matches the container exactly', () => {
      const result = calculateFitDimensions(400, 300, 400, 300, 'none');
      expect(result).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    });
  });

  describe('contain', () => {
    it('fits within container preserving aspect ratio and centers', () => {
      const result = calculateFitDimensions(800, 400, 400, 400, 'contain');
      // Scale limited by width: 400/800 = 0.5
      const scale = Math.min(400 / 800, 400 / 400);
      const w = 800 * scale;
      const h = 400 * scale;
      expect(result.width).toBeCloseTo(w);
      expect(result.height).toBeCloseTo(h);
      expect(result.x).toBeCloseTo((400 - w) / 2);
      expect(result.y).toBeCloseTo((400 - h) / 2);
    });

    it('does not exceed container in either dimension', () => {
      const result = calculateFitDimensions(1920, 1080, 500, 300, 'contain');
      expect(result.width).toBeLessThanOrEqual(500 + 0.001);
      expect(result.height).toBeLessThanOrEqual(300 + 0.001);
    });

    it('preserves aspect ratio', () => {
      const result = calculateFitDimensions(1920, 1080, 500, 300, 'contain');
      expect(result.width / result.height).toBeCloseTo(1920 / 1080);
    });

    it('scales up a small image to fit the container', () => {
      const result = calculateFitDimensions(100, 50, 400, 400, 'contain');
      // Scale limited by width: 400/100 = 4
      expect(result.width).toBeCloseTo(400);
      expect(result.height).toBeCloseTo(200);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(100);
    });
  });

  describe('cover', () => {
    it('fills the entire container preserving aspect ratio', () => {
      const result = calculateFitDimensions(800, 400, 400, 400, 'cover');
      // Scale determined by the larger ratio: 400/400 = 1
      const scale = Math.max(400 / 800, 400 / 400);
      const w = 800 * scale;
      const h = 400 * scale;
      expect(result.width).toBeCloseTo(w);
      expect(result.height).toBeCloseTo(h);
      expect(result.x).toBeCloseTo((400 - w) / 2);
      expect(result.y).toBeCloseTo((400 - h) / 2);
    });

    it('covers the container fully (at least one dimension matches)', () => {
      const result = calculateFitDimensions(1920, 1080, 500, 300, 'cover');
      // At least one dimension must be >= container
      const coversWidth = result.width >= 500 - 0.001;
      const coversHeight = result.height >= 300 - 0.001;
      expect(coversWidth && coversHeight).toBe(true);
    });

    it('preserves aspect ratio', () => {
      const result = calculateFitDimensions(1920, 1080, 500, 300, 'cover');
      expect(result.width / result.height).toBeCloseTo(1920 / 1080);
    });

    it('may produce negative offsets for the cropped dimension', () => {
      // Landscape image in a square container
      const result = calculateFitDimensions(800, 400, 400, 400, 'cover');
      // Width will exceed container, so x should be negative
      expect(result.width).toBeGreaterThan(400);
      expect(result.x).toBeLessThan(0);
    });
  });

  describe('scale-down', () => {
    it('behaves like none when image is smaller than container', () => {
      const scaleDown = calculateFitDimensions(200, 100, 400, 300, 'scale-down');
      const none = calculateFitDimensions(200, 100, 400, 300, 'none');
      expect(scaleDown).toEqual(none);
    });

    it('behaves like none when image exactly matches the container', () => {
      const scaleDown = calculateFitDimensions(400, 300, 400, 300, 'scale-down');
      const none = calculateFitDimensions(400, 300, 400, 300, 'none');
      expect(scaleDown).toEqual(none);
    });

    it('behaves like contain when image is larger than container', () => {
      const scaleDown = calculateFitDimensions(1920, 1080, 500, 300, 'scale-down');
      const contain = calculateFitDimensions(1920, 1080, 500, 300, 'contain');
      expect(scaleDown).toEqual(contain);
    });

    it('behaves like contain when only width exceeds container', () => {
      const scaleDown = calculateFitDimensions(800, 200, 400, 300, 'scale-down');
      const contain = calculateFitDimensions(800, 200, 400, 300, 'contain');
      expect(scaleDown).toEqual(contain);
    });

    it('behaves like contain when only height exceeds container', () => {
      const scaleDown = calculateFitDimensions(200, 600, 400, 300, 'scale-down');
      const contain = calculateFitDimensions(200, 600, 400, 300, 'contain');
      expect(scaleDown).toEqual(contain);
    });

    it('never scales up', () => {
      const result = calculateFitDimensions(50, 30, 400, 300, 'scale-down');
      expect(result.width).toBe(50);
      expect(result.height).toBe(30);
    });
  });

  describe('landscape image in portrait container', () => {
    const srcW = 1600;
    const srcH = 900;
    const contW = 300;
    const contH = 500;

    it('contain: width-limited, centered vertically', () => {
      const result = calculateFitDimensions(srcW, srcH, contW, contH, 'contain');
      // Scale limited by width: 300/1600
      const scale = Math.min(contW / srcW, contH / srcH);
      expect(result.width).toBeCloseTo(srcW * scale);
      expect(result.height).toBeCloseTo(srcH * scale);
      // Centered vertically with positive y offset
      expect(result.y).toBeGreaterThan(0);
      expect(result.x).toBeCloseTo(0);
    });

    it('cover: height-limited, overflows horizontally', () => {
      const result = calculateFitDimensions(srcW, srcH, contW, contH, 'cover');
      const scale = Math.max(contW / srcW, contH / srcH);
      expect(result.width).toBeCloseTo(srcW * scale);
      expect(result.height).toBeCloseTo(srcH * scale);
      // Overflows horizontally
      expect(result.width).toBeGreaterThan(contW);
      expect(result.x).toBeLessThan(0);
    });

    it('fill: stretches to fill container exactly', () => {
      const result = calculateFitDimensions(srcW, srcH, contW, contH, 'fill');
      expect(result).toEqual({ x: 0, y: 0, width: contW, height: contH });
    });
  });

  describe('portrait image in landscape container', () => {
    const srcW = 900;
    const srcH = 1600;
    const contW = 500;
    const contH = 300;

    it('contain: height-limited, centered horizontally', () => {
      const result = calculateFitDimensions(srcW, srcH, contW, contH, 'contain');
      const scale = Math.min(contW / srcW, contH / srcH);
      expect(result.width).toBeCloseTo(srcW * scale);
      expect(result.height).toBeCloseTo(srcH * scale);
      // Centered horizontally with positive x offset
      expect(result.x).toBeGreaterThan(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('cover: width-limited, overflows vertically', () => {
      const result = calculateFitDimensions(srcW, srcH, contW, contH, 'cover');
      const scale = Math.max(contW / srcW, contH / srcH);
      expect(result.width).toBeCloseTo(srcW * scale);
      expect(result.height).toBeCloseTo(srcH * scale);
      // Overflows vertically
      expect(result.height).toBeGreaterThan(contH);
      expect(result.y).toBeLessThan(0);
    });

    it('fill: stretches to fill container exactly', () => {
      const result = calculateFitDimensions(srcW, srcH, contW, contH, 'fill');
      expect(result).toEqual({ x: 0, y: 0, width: contW, height: contH });
    });
  });

  describe('square image in non-square container', () => {
    const srcW = 500;
    const srcH = 500;

    it('contain in a wide container: limited by height', () => {
      const result = calculateFitDimensions(srcW, srcH, 800, 400, 'contain');
      // Scale limited by height: 400/500 = 0.8
      expect(result.width).toBeCloseTo(400);
      expect(result.height).toBeCloseTo(400);
      // Centered horizontally
      expect(result.x).toBeCloseTo((800 - 400) / 2);
      expect(result.y).toBeCloseTo(0);
    });

    it('contain in a tall container: limited by width', () => {
      const result = calculateFitDimensions(srcW, srcH, 400, 800, 'contain');
      // Scale limited by width: 400/500 = 0.8
      expect(result.width).toBeCloseTo(400);
      expect(result.height).toBeCloseTo(400);
      // Centered vertically
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo((800 - 400) / 2);
    });

    it('cover in a wide container: fills width, overflows height', () => {
      const result = calculateFitDimensions(srcW, srcH, 800, 400, 'cover');
      // Scale determined by width: 800/500 = 1.6
      expect(result.width).toBeCloseTo(800);
      expect(result.height).toBeCloseTo(800);
      expect(result.y).toBeLessThan(0);
    });

    it('cover in a tall container: fills height, overflows width', () => {
      const result = calculateFitDimensions(srcW, srcH, 400, 800, 'cover');
      // Scale determined by height: 800/500 = 1.6
      expect(result.width).toBeCloseTo(800);
      expect(result.height).toBeCloseTo(800);
      expect(result.x).toBeLessThan(0);
    });

    it('fill: stretches to match container regardless of shape', () => {
      const result = calculateFitDimensions(srcW, srcH, 800, 400, 'fill');
      expect(result).toEqual({ x: 0, y: 0, width: 800, height: 400 });
    });

    it('scale-down when square image fits: stays at original size', () => {
      const result = calculateFitDimensions(srcW, srcH, 800, 600, 'scale-down');
      expect(result.width).toBe(500);
      expect(result.height).toBe(500);
      expect(result.x).toBeCloseTo((800 - 500) / 2);
      expect(result.y).toBeCloseTo((600 - 500) / 2);
    });

    it('scale-down when square image exceeds container: shrinks like contain', () => {
      const result = calculateFitDimensions(srcW, srcH, 200, 300, 'scale-down');
      const contain = calculateFitDimensions(srcW, srcH, 200, 300, 'contain');
      expect(result).toEqual(contain);
    });
  });
});
