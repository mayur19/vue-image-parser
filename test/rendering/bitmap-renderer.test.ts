import { describe, it, expect, vi, beforeAll } from 'vitest';
import { toDataURL, toBlobURL } from '@/rendering/bitmap-renderer';
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

beforeAll(() => {
  // jsdom does not implement ImageData or canvas rendering APIs.
  // Provide minimal stubs so the bitmap-renderer functions can be exercised.
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as any).ImageData = class {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    };
  }

  // jsdom does not implement URL.createObjectURL / revokeObjectURL
  if (typeof URL.createObjectURL === 'undefined') {
    let blobCounter = 0;
    URL.createObjectURL = (_blob: Blob) => `blob:mock-${++blobCounter}`;
    URL.revokeObjectURL = vi.fn();
  }

  // Stub getContext and canvas output methods
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args: any[]) => {
    if (tag === 'canvas') {
      const canvas = originalCreateElement('canvas') as HTMLCanvasElement;
      (canvas as any).getContext = () => ({ putImageData: vi.fn() });
      canvas.toDataURL = (_mime?: string) => 'data:image/png;base64,AAAA';
      canvas.toBlob = (callback: BlobCallback, _mime?: string) => {
        const blob = new Blob([''], { type: 'image/png' });
        callback(blob);
      };
      return canvas;
    }
    return originalCreateElement(tag, ...args);
  });
});

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
