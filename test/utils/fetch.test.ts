import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAsArrayBuffer } from '../../src/utils/fetch';

describe('fetchAsArrayBuffer', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function mockFetch(body: ArrayBuffer, options: { status?: number; statusText?: string; contentLength?: number } = {}) {
    const { status = 200, statusText = 'OK', contentLength } = options;
    const headers = new Headers();
    if (contentLength !== undefined) {
      headers.set('content-length', String(contentLength));
    }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      headers,
      body: null,
      arrayBuffer: vi.fn().mockResolvedValue(body),
    });
  }

  it('fetches a URL and returns ArrayBuffer', async () => {
    const expected = new Uint8Array([1, 2, 3]).buffer;
    mockFetch(expected);

    const result = await fetchAsArrayBuffer('https://example.com/image.jpg');
    expect(new Uint8Array(result)).toEqual(new Uint8Array(expected));
  });

  it('throws FetchError on non-OK response', async () => {
    mockFetch(new ArrayBuffer(0), { status: 404, statusText: 'Not Found' });

    await expect(fetchAsArrayBuffer('https://example.com/missing.jpg'))
      .rejects.toThrow('HTTP 404');
  });

  it('throws on file too large via Content-Length header', async () => {
    const small = new Uint8Array([1]).buffer;
    mockFetch(small, { contentLength: 200_000_000 });

    await expect(fetchAsArrayBuffer('https://example.com/huge.jpg', { maxFileSize: 100_000_000 }))
      .rejects.toThrow('exceeds maximum');
  });

  it('throws on file too large via actual buffer size', async () => {
    const large = new ArrayBuffer(200);
    mockFetch(large);

    await expect(fetchAsArrayBuffer('https://example.com/image.jpg', { maxFileSize: 100 }))
      .rejects.toThrow('exceeds maximum');
  });

  it('allows files within size limit', async () => {
    const small = new Uint8Array([1, 2, 3]).buffer;
    mockFetch(small);

    const result = await fetchAsArrayBuffer('https://example.com/small.jpg', { maxFileSize: 1000 });
    expect(result.byteLength).toBe(3);
  });

  it('rejects javascript: URLs', async () => {
    await expect(fetchAsArrayBuffer('javascript:alert(1)'))
      .rejects.toThrow('Unsafe URL protocol');
  });

  it('rejects file: URLs', async () => {
    await expect(fetchAsArrayBuffer('file:///etc/passwd'))
      .rejects.toThrow('Unsafe URL protocol');
  });

  it('allows data: URLs', async () => {
    const expected = new Uint8Array([1]).buffer;
    mockFetch(expected);

    const result = await fetchAsArrayBuffer('data:image/png;base64,AAAA');
    expect(result).toBeDefined();
  });

  it('allows blob: URLs (from URL.createObjectURL)', async () => {
    const expected = new Uint8Array([1, 2, 3]).buffer;
    mockFetch(expected);

    const result = await fetchAsArrayBuffer('blob:http://localhost/abc-123');
    expect(result.byteLength).toBe(3);
  });

  it('allows relative URLs', async () => {
    const expected = new Uint8Array([1]).buffer;
    mockFetch(expected);

    const result = await fetchAsArrayBuffer('/images/photo.jpg');
    expect(result).toBeDefined();
  });

  it('throws AbortError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = vi.fn().mockRejectedValue(
      new DOMException('Aborted', 'AbortError'),
    );

    await expect(fetchAsArrayBuffer('https://example.com/image.jpg', { signal: controller.signal }))
      .rejects.toThrow();
  });

  it('passes maxFileSize=0 to disable size check', async () => {
    const large = new ArrayBuffer(200);
    mockFetch(large);

    const result = await fetchAsArrayBuffer('https://example.com/image.jpg', { maxFileSize: 0 });
    expect(result.byteLength).toBe(200);
  });

  it('throws on file too large during streaming (onProgress path)', async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array(new Array(200).fill(0));

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });

    const headers = new Headers({ 'content-length': '10' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers,
      body: stream,
      arrayBuffer: vi.fn(),
    });

    await expect(
      fetchAsArrayBuffer('https://example.com/image.jpg', {
        maxFileSize: 100,
        onProgress: () => {},
      }),
    ).rejects.toThrow('exceeds maximum');
  });

  it('allows streaming files within size limit', async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });

    const headers = new Headers({ 'content-length': '6' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers,
      body: stream,
      arrayBuffer: vi.fn(),
    });

    const progress: number[] = [];
    const result = await fetchAsArrayBuffer('https://example.com/image.jpg', {
      maxFileSize: 1000,
      onProgress: (p) => progress.push(p),
    });

    expect(result.byteLength).toBe(6);
    expect(progress.length).toBe(2);
    expect(progress[progress.length - 1]).toBe(1.0);
  });
});
