import { describe, it, expect } from 'vitest';
import {
  serializeError,
  deserializeError,
  toTransferable,
  fromTransferable,
  getRequestTransferables,
  generateRequestId,
} from '../../src/workers/protocol';
import { ImageFormat } from '../../src/types/image';
import type { TransferableDecodedImage, WorkerDecodeRequest, WorkerInitCodecRequest } from '../../src/types/worker';
import type { DecodedImage } from '../../src/types/image';

function createMockDecodedImage(): DecodedImage {
  return {
    data: new Uint8ClampedArray([255, 0, 0, 255]),
    width: 1,
    height: 1,
    format: ImageFormat.JPEG,
    orientation: 1,
    decodePath: 'native' as const,
    dispose: () => {},
  };
}

describe('serializeError', () => {
  it('serializes an Error instance to { code: "UNKNOWN", message, stack }', () => {
    const error = new Error('something went wrong');
    const serialized = serializeError(error);

    expect(serialized.code).toBe('UNKNOWN');
    expect(serialized.message).toBe('something went wrong');
    expect(serialized.stack).toBeDefined();
    expect(serialized.stack).toContain('something went wrong');
  });

  it('uses the .code property when present on the Error', () => {
    const error = new Error('decode failed');
    (error as any).code = 'DECODE_ERROR';
    const serialized = serializeError(error);

    expect(serialized.code).toBe('DECODE_ERROR');
    expect(serialized.message).toBe('decode failed');
  });

  it('serializes a non-Error value to { code: "UNKNOWN", message: String(value) }', () => {
    expect(serializeError('plain string')).toEqual({
      code: 'UNKNOWN',
      message: 'plain string',
    });

    expect(serializeError(42)).toEqual({
      code: 'UNKNOWN',
      message: '42',
    });

    expect(serializeError(null)).toEqual({
      code: 'UNKNOWN',
      message: 'null',
    });

    expect(serializeError(undefined)).toEqual({
      code: 'UNKNOWN',
      message: 'undefined',
    });
  });
});

describe('deserializeError', () => {
  it('reconstructs an Error with the correct message and code', () => {
    const deserialized = deserializeError({
      code: 'DECODE_ERROR',
      message: 'failed to decode',
    });

    expect(deserialized).toBeInstanceOf(Error);
    expect(deserialized.message).toBe('failed to decode');
    expect((deserialized as any).code).toBe('DECODE_ERROR');
  });

  it('preserves the stack trace when provided', () => {
    const originalStack = 'Error: test\n    at Object.<anonymous> (test.ts:1:1)';
    const deserialized = deserializeError({
      code: 'UNKNOWN',
      message: 'test',
      stack: originalStack,
    });

    expect(deserialized.stack).toBe(originalStack);
  });

  it('does not set a custom stack when none is provided', () => {
    const deserialized = deserializeError({
      code: 'UNKNOWN',
      message: 'no stack',
    });

    // The Error constructor generates a default stack; it should NOT be the serialized one
    expect(deserialized).toBeInstanceOf(Error);
    expect(deserialized.stack).toBeDefined();
    expect(deserialized.stack).toContain('no stack');
  });
});

describe('toTransferable', () => {
  it('creates a TransferableDecodedImage from a DecodedImage', () => {
    const mockImage = createMockDecodedImage();
    const { data, transfer } = toTransferable(mockImage);

    expect(data.width).toBe(1);
    expect(data.height).toBe(1);
    expect(data.format).toBe(ImageFormat.JPEG);
    expect(data.orientation).toBe(1);
    expect(data.decodePath).toBe('native');
    expect(data.data).toBeInstanceOf(ArrayBuffer);
  });

  it('extracts the underlying ArrayBuffer as a transferable', () => {
    const mockImage = createMockDecodedImage();
    const expectedBuffer = mockImage.data.buffer;
    const { data, transfer } = toTransferable(mockImage);

    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBe(expectedBuffer);
    expect(data.data).toBe(expectedBuffer);
  });
});

describe('fromTransferable', () => {
  it('reconstructs a DecodedImage with Uint8ClampedArray from an ArrayBuffer', () => {
    const transferred: TransferableDecodedImage = {
      data: new Uint8ClampedArray([255, 0, 0, 255]).buffer,
      width: 1,
      height: 1,
      format: ImageFormat.JPEG,
      orientation: 1,
      decodePath: 'native',
    };

    const image = fromTransferable(transferred);

    expect(image.data).toBeInstanceOf(Uint8ClampedArray);
    expect(image.data).toEqual(new Uint8ClampedArray([255, 0, 0, 255]));
    expect(image.width).toBe(1);
    expect(image.height).toBe(1);
    expect(image.format).toBe(ImageFormat.JPEG);
    expect(image.orientation).toBe(1);
    expect(image.decodePath).toBe('native');
  });

  it('returned image has a dispose() method', () => {
    const transferred: TransferableDecodedImage = {
      data: new Uint8ClampedArray([0, 0, 0, 0]).buffer,
      width: 1,
      height: 1,
      format: ImageFormat.PNG,
      orientation: 1,
      decodePath: 'wasm',
    };

    const image = fromTransferable(transferred);

    expect(typeof image.dispose).toBe('function');
    // Calling dispose should not throw
    expect(() => image.dispose()).not.toThrow();
    // Calling dispose again (idempotent) should not throw
    expect(() => image.dispose()).not.toThrow();
  });
});

describe('getRequestTransferables', () => {
  it('returns [buffer] for a decode request', () => {
    const buffer = new ArrayBuffer(16);
    const request: WorkerDecodeRequest = {
      type: 'decode',
      id: 'req-1',
      buffer,
      format: ImageFormat.JPEG,
    };

    const transferables = getRequestTransferables(request);

    expect(transferables).toHaveLength(1);
    expect(transferables[0]).toBe(buffer);
  });

  it('returns an empty array for a non-decode request', () => {
    const initRequest: WorkerInitCodecRequest = {
      type: 'init-codec',
      id: 'req-2',
      format: ImageFormat.AVIF,
    };

    expect(getRequestTransferables(initRequest)).toEqual([]);

    const disposeRequest = { type: 'dispose' as const };

    expect(getRequestTransferables(disposeRequest)).toEqual([]);
  });
});

describe('generateRequestId', () => {
  it('returns a string', () => {
    const id = generateRequestId();

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns different IDs on consecutive calls', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();

    expect(id1).not.toBe(id2);
  });
});
