import { describe, it, expect, beforeEach } from 'vitest';
import { CanvasPool } from '@/rendering/canvas-pool';

describe('CanvasPool', () => {
  let pool: CanvasPool;

  beforeEach(() => {
    pool = new CanvasPool(2);
  });

  it('creates a new canvas on first acquire', () => {
    const canvas = pool.acquire(100, 200);
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(200);
  });

  it('reuses canvas when dimensions match (same reference)', () => {
    const canvas = pool.acquire(100, 200);
    pool.release(canvas);
    const reused = pool.acquire(100, 200);
    expect(reused).toBe(canvas);
  });

  it('creates new canvas when dimensions differ (different reference)', () => {
    const canvas = pool.acquire(100, 200);
    pool.release(canvas);
    const other = pool.acquire(300, 400);
    expect(other).not.toBe(canvas);
    expect(other.width).toBe(300);
    expect(other.height).toBe(400);
  });

  it('evicts oldest entry when pool is full (2-slot pool)', () => {
    const a = pool.acquire(10, 10);
    const b = pool.acquire(20, 20);

    // Fill the 2-slot pool
    pool.release(a);
    pool.release(b);

    // Add a third canvas — pool is full, oldest (a) must be evicted
    const c = pool.acquire(30, 30);
    pool.release(c);

    // 'a' was the oldest; acquiring 10x10 should create a new canvas, not return 'a'
    const reacquiredA = pool.acquire(10, 10);
    expect(reacquiredA).not.toBe(a);

    // 'b' should still be in the pool and reusable
    const reacquiredB = pool.acquire(20, 20);
    expect(reacquiredB).toBe(b);
  });

  it('dispose() clears all slots; acquire after dispose returns new canvas', () => {
    const canvas = pool.acquire(100, 200);
    pool.release(canvas);

    pool.dispose();

    const fresh = pool.acquire(100, 200);
    expect(fresh).not.toBe(canvas);
  });
});
