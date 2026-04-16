import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToCanvas } from '@/rendering/canvas-renderer';
import type { DecodedImage } from '@/types/image';

function makeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: () => {} } as unknown as ImageBitmap;
}

function makeDecoded(width: number, height: number, withBitmap = true): DecodedImage {
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    data,
    format: 'png',
    bitmap: withBitmap ? makeBitmap(width, height) : undefined,
  } as DecodedImage;
}

interface CtxSpy {
  drawImage: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  fillStyle: string;
}

function makeCanvasWithSpyCtx(cssWidth = 0, cssHeight = 0): {
  canvas: HTMLCanvasElement;
  ctx: CtxSpy;
} {
  const canvas = document.createElement('canvas');
  const ctx: CtxSpy = {
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: '',
  };
  canvas.getContext = vi.fn().mockReturnValue(ctx) as unknown as HTMLCanvasElement['getContext'];
  canvas.getBoundingClientRect = vi.fn().mockReturnValue({
    width: cssWidth,
    height: cssHeight,
    top: 0,
    left: 0,
    right: cssWidth,
    bottom: cssHeight,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as unknown as HTMLCanvasElement['getBoundingClientRect'];
  return { canvas, ctx };
}

describe('renderToCanvas — no inline style mutation (bug fix #2)', () => {
  it('does NOT write canvas.style.width or canvas.style.height', () => {
    const { canvas } = makeCanvasWithSpyCtx(220, 220);
    const image = makeDecoded(1000, 1000);

    renderToCanvas(canvas, image, { width: 220, height: 220, fit: 'cover', dpr: 1 });

    expect(canvas.style.width).toBe('');
    expect(canvas.style.height).toBe('');
  });
});

describe('renderToCanvas — container dimensions drive drawing buffer', () => {
  it('sizes drawing buffer to container × dpr, not image × dpr', () => {
    const { canvas } = makeCanvasWithSpyCtx(220, 220);
    const image = makeDecoded(4000, 3000);

    renderToCanvas(canvas, image, { width: 220, height: 220, fit: 'cover', dpr: 2 });

    expect(canvas.width).toBe(440);
    expect(canvas.height).toBe(440);
  });

  it('falls back to getBoundingClientRect when width/height options are omitted', () => {
    const { canvas } = makeCanvasWithSpyCtx(300, 200);
    const image = makeDecoded(4000, 3000);

    renderToCanvas(canvas, image, { fit: 'cover', dpr: 1 });

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(200);
  });

  it('falls back to image dimensions when both options and rect are zero', () => {
    const { canvas } = makeCanvasWithSpyCtx(0, 0);
    const image = makeDecoded(640, 480);

    renderToCanvas(canvas, image, { fit: 'cover', dpr: 1 });

    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
  });
});

describe('renderToCanvas — fit math honors container, not image', () => {
  it('cover of a wide image into a square container produces a dest width > container width', () => {
    const { canvas, ctx } = makeCanvasWithSpyCtx();
    const image = makeDecoded(2000, 1000);

    renderToCanvas(canvas, image, { width: 220, height: 220, fit: 'cover', dpr: 1 });

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    const args = ctx.drawImage.mock.calls[0];
    const destWidth = args[3] as number;
    const destHeight = args[4] as number;
    expect(destWidth).toBeGreaterThanOrEqual(220);
    expect(destHeight).toBeGreaterThanOrEqual(220);
    expect(destWidth).toBe(440);
    expect(destHeight).toBe(220);
  });

  it('contain of a wide image into a square container produces letterbox', () => {
    const { canvas, ctx } = makeCanvasWithSpyCtx();
    const image = makeDecoded(2000, 1000);

    renderToCanvas(canvas, image, { width: 220, height: 220, fit: 'contain', dpr: 1 });

    const args = ctx.drawImage.mock.calls[0];
    const destWidth = args[3] as number;
    const destHeight = args[4] as number;
    expect(destWidth).toBe(220);
    expect(destHeight).toBe(110);
  });

  it('fit=cover is NOT silently converted to fit=none when options.width/height omitted (regression)', () => {
    const { canvas, ctx } = makeCanvasWithSpyCtx(220, 220);
    const image = makeDecoded(2000, 1000);

    renderToCanvas(canvas, image, { fit: 'cover', dpr: 1 });

    const args = ctx.drawImage.mock.calls[0];
    const destWidth = args[3] as number;
    const destHeight = args[4] as number;
    expect(destWidth).toBe(440);
    expect(destHeight).toBe(220);
  });
});

describe('renderToCanvas — DPR transform hygiene', () => {
  it('resets the transform before applying the DPR scale so reruns do not compound', () => {
    const { canvas, ctx } = makeCanvasWithSpyCtx(220, 220);
    const image = makeDecoded(1000, 1000);

    renderToCanvas(canvas, image, { width: 220, height: 220, dpr: 2 });

    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    const setTransformOrder = ctx.setTransform.mock.invocationCallOrder[0];
    const scaleOrder = ctx.scale.mock.invocationCallOrder[0];
    expect(setTransformOrder).toBeLessThan(scaleOrder);
  });

  it('applies ctx.scale(dpr, dpr) exactly once', () => {
    const { canvas, ctx } = makeCanvasWithSpyCtx(220, 220);
    const image = makeDecoded(1000, 1000);

    renderToCanvas(canvas, image, { width: 220, height: 220, dpr: 3 });

    expect(ctx.scale).toHaveBeenCalledTimes(1);
    expect(ctx.scale).toHaveBeenCalledWith(3, 3);
  });
});
