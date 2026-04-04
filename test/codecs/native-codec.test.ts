import { describe, it, expect, vi } from 'vitest';

describe('NativeCodec with lazy bitmap', () => {
  it('returns a DecodedImage with bitmap field set', async () => {
    const mockBitmap = { width: 100, height: 100, close: vi.fn() } as unknown as ImageBitmap;
    const mockImageData = { data: new Uint8ClampedArray(100 * 100 * 4), width: 100, height: 100 };

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap));
    vi.stubGlobal('OffscreenCanvas', vi.fn().mockImplementation((w: number, h: number) => ({
      width: w, height: h,
      getContext: () => ({ drawImage: vi.fn(), getImageData: () => mockImageData }),
    })));

    const { NativeCodec } = await import('@/codecs/native-codec');
    const codec = new NativeCodec();
    const result = await codec.decode(new ArrayBuffer(8));

    expect(result.bitmap).toBeDefined();
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.decodePath).toBe('native');
  });

  it('dispose closes the bitmap', async () => {
    const closeFn = vi.fn();
    const mockBitmap = { width: 50, height: 50, close: closeFn } as unknown as ImageBitmap;

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap));
    vi.stubGlobal('OffscreenCanvas', vi.fn().mockImplementation((w: number, h: number) => ({
      width: w, height: h,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      }),
    })));

    const { NativeCodec } = await import('@/codecs/native-codec');
    const codec = new NativeCodec();
    const result = await codec.decode(new ArrayBuffer(8));
    result.dispose();
    expect(closeFn).toHaveBeenCalled();
  });
});
