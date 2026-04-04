import { describe, it, expect } from 'vitest';

describe('warmup', () => {
  it('is exported from the public API', async () => {
    const api = await import('@/index');
    expect(api.warmup).toBeDefined();
    expect(typeof api.warmup).toBe('function');
  });
});
