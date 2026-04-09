import { describe, it, expect } from 'vitest';
import {
  base64ToArrayBuffer,
  arrayBufferToBase64,
  base64ToBlob,
  blobToArrayBuffer,
  concatBuffers,
} from '../../src/utils/buffer';

/**
 * Helper: create an ArrayBuffer from a plain byte array.
 */
function bytesToBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/**
 * Helper: read all bytes from an ArrayBuffer as a plain number array.
 */
function bufferToBytes(buffer: ArrayBuffer): number[] {
  return Array.from(new Uint8Array(buffer));
}

describe('base64ToArrayBuffer', () => {
  it('decodes a known base64 string to the correct bytes', () => {
    // "Hello" in base64 is "SGVsbG8="
    const result = base64ToArrayBuffer('SGVsbG8=');
    const bytes = bufferToBytes(result);
    // H=72, e=101, l=108, l=108, o=111
    expect(bytes).toEqual([72, 101, 108, 108, 111]);
  });

  it('decodes a single-byte base64 string', () => {
    // "QQ==" is base64 for "A" (0x41 = 65)
    const result = base64ToArrayBuffer('QQ==');
    expect(bufferToBytes(result)).toEqual([65]);
  });

  it('returns an empty ArrayBuffer for an empty base64 string', () => {
    const result = base64ToArrayBuffer('');
    expect(result.byteLength).toBe(0);
    expect(bufferToBytes(result)).toEqual([]);
  });
});

describe('arrayBufferToBase64', () => {
  it('encodes known bytes to the correct base64 string', () => {
    const buffer = bytesToBuffer([72, 101, 108, 108, 111]); // "Hello"
    expect(arrayBufferToBase64(buffer)).toBe('SGVsbG8=');
  });

  it('encodes a single byte', () => {
    const buffer = bytesToBuffer([65]); // "A"
    expect(arrayBufferToBase64(buffer)).toBe('QQ==');
  });

  it('returns an empty string for an empty buffer', () => {
    const buffer = bytesToBuffer([]);
    expect(arrayBufferToBase64(buffer)).toBe('');
  });

  it('encodes binary bytes (non-ASCII range)', () => {
    const buffer = bytesToBuffer([0, 128, 255]);
    const base64 = arrayBufferToBase64(buffer);
    // Verify via roundtrip
    const decoded = bufferToBytes(base64ToArrayBuffer(base64));
    expect(decoded).toEqual([0, 128, 255]);
  });
});

describe('roundtrip: base64 -> buffer -> base64', () => {
  it('preserves a standard base64 string through the roundtrip', () => {
    const original = 'SGVsbG8gV29ybGQh'; // "Hello World!"
    const buffer = base64ToArrayBuffer(original);
    const result = arrayBufferToBase64(buffer);
    expect(result).toBe(original);
  });

  it('preserves an empty string through the roundtrip', () => {
    const original = '';
    const buffer = base64ToArrayBuffer(original);
    const result = arrayBufferToBase64(buffer);
    expect(result).toBe(original);
  });

  it('preserves base64 with padding through the roundtrip', () => {
    // "ab" -> base64 "YWI=" (two-byte input, one padding char)
    const original = 'YWI=';
    const buffer = base64ToArrayBuffer(original);
    const result = arrayBufferToBase64(buffer);
    expect(result).toBe(original);
  });
});

describe('roundtrip: buffer -> base64 -> buffer', () => {
  it('preserves arbitrary bytes through the roundtrip', () => {
    const originalBytes = [0, 1, 127, 128, 254, 255];
    const buffer = bytesToBuffer(originalBytes);
    const base64 = arrayBufferToBase64(buffer);
    const restored = base64ToArrayBuffer(base64);
    expect(bufferToBytes(restored)).toEqual(originalBytes);
  });

  it('preserves a large sequential byte sequence', () => {
    const originalBytes = Array.from({ length: 256 }, (_, i) => i);
    const buffer = bytesToBuffer(originalBytes);
    const base64 = arrayBufferToBase64(buffer);
    const restored = base64ToArrayBuffer(base64);
    expect(bufferToBytes(restored)).toEqual(originalBytes);
  });

  it('preserves an empty buffer through the roundtrip', () => {
    const buffer = bytesToBuffer([]);
    const base64 = arrayBufferToBase64(buffer);
    const restored = base64ToArrayBuffer(base64);
    expect(restored.byteLength).toBe(0);
  });
});

describe('base64ToBlob', () => {
  it('creates a blob with the correct MIME type', () => {
    const blob = base64ToBlob('SGVsbG8=', 'text/plain');
    expect(blob.type).toBe('text/plain');
  });

  it('creates a blob with the correct size', () => {
    // "Hello" = 5 bytes
    const blob = base64ToBlob('SGVsbG8=', 'text/plain');
    expect(blob.size).toBe(5);
  });

  it('creates a blob with an image MIME type', () => {
    // Minimal bytes, just verifying type propagation
    const blob = base64ToBlob('AAAA', 'image/png');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(3); // 4 base64 chars = 3 bytes
  });

  it('creates an empty blob from an empty base64 string', () => {
    const blob = base64ToBlob('', 'application/octet-stream');
    expect(blob.size).toBe(0);
    expect(blob.type).toBe('application/octet-stream');
  });
});

describe('blobToArrayBuffer', () => {
  it('converts a blob back to an ArrayBuffer with correct contents', async () => {
    const original = [72, 101, 108, 108, 111]; // "Hello"
    const blob = new Blob([new Uint8Array(original)]);
    const buffer = await blobToArrayBuffer(blob);
    expect(bufferToBytes(buffer)).toEqual(original);
  });

  it('handles an empty blob', async () => {
    const blob = new Blob([]);
    const buffer = await blobToArrayBuffer(blob);
    expect(buffer.byteLength).toBe(0);
  });

  it('roundtrips through base64ToBlob and back', async () => {
    const base64 = 'SGVsbG8gV29ybGQh'; // "Hello World!"
    const blob = base64ToBlob(base64, 'application/octet-stream');
    const buffer = await blobToArrayBuffer(blob);
    const resultBase64 = arrayBufferToBase64(buffer);
    expect(resultBase64).toBe(base64);
  });
});

describe('concatBuffers', () => {
  it('concatenates two buffers into one with combined contents', () => {
    const a = bytesToBuffer([1, 2, 3]);
    const b = bytesToBuffer([4, 5, 6]);
    const result = concatBuffers(a, b);
    expect(result.byteLength).toBe(6);
    expect(bufferToBytes(result)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('concatenates three buffers', () => {
    const a = bytesToBuffer([10]);
    const b = bytesToBuffer([20, 30]);
    const c = bytesToBuffer([40, 50, 60]);
    const result = concatBuffers(a, b, c);
    expect(result.byteLength).toBe(6);
    expect(bufferToBytes(result)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('returns an empty buffer when concatenating no buffers', () => {
    const result = concatBuffers();
    expect(result.byteLength).toBe(0);
    expect(bufferToBytes(result)).toEqual([]);
  });

  it('returns an empty buffer when concatenating only empty buffers', () => {
    const a = bytesToBuffer([]);
    const b = bytesToBuffer([]);
    const result = concatBuffers(a, b);
    expect(result.byteLength).toBe(0);
    expect(bufferToBytes(result)).toEqual([]);
  });

  it('returns a copy when given a single buffer (not the same reference)', () => {
    const original = bytesToBuffer([7, 8, 9]);
    const result = concatBuffers(original);
    expect(bufferToBytes(result)).toEqual([7, 8, 9]);
    expect(result).not.toBe(original);
  });

  it('handles a mix of empty and non-empty buffers', () => {
    const a = bytesToBuffer([]);
    const b = bytesToBuffer([1, 2]);
    const c = bytesToBuffer([]);
    const d = bytesToBuffer([3]);
    const result = concatBuffers(a, b, c, d);
    expect(bufferToBytes(result)).toEqual([1, 2, 3]);
  });
});
