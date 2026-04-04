/**
 * Decode Worker entry point.
 * This file runs in a Web Worker context — no DOM access.
 *
 * Receives decode requests from the main thread,
 * uses the codec registry to decode images,
 * and transfers results back with zero-copy ArrayBuffer transfer.
 */

import type { WorkerRequest, WorkerResponse } from '../types/worker';
import { detectFormat } from '../detection/detect';
import { serializeError, toTransferable } from './protocol';
import type { ImageFormat, DecodedImage } from '../types/image';
import type { Codec, DecodeOptions } from '../types/codec';

// ─── Codec Registry (within worker context) ────────────────────

/**
 * In-worker codec instances (lazy-loaded).
 */
const codecs = new Map<ImageFormat, Codec>();
const codecLoading = new Map<ImageFormat, Promise<void>>();

/**
 * Lazy-load a codec for the given format within the worker.
 */
async function ensureCodec(format: ImageFormat): Promise<Codec | null> {
  if (codecs.has(format)) return codecs.get(format)!;

  // Prevent duplicate init
  if (codecLoading.has(format)) {
    await codecLoading.get(format);
    return codecs.get(format) ?? null;
  }

  const loadPromise = loadCodec(format);
  codecLoading.set(format, loadPromise);

  try {
    await loadPromise;
    return codecs.get(format) ?? null;
  } catch {
    return null;
  } finally {
    codecLoading.delete(format);
  }
}

/**
 * Dynamic import of codec modules based on format.
 */
async function loadCodec(format: ImageFormat): Promise<void> {
  switch (format) {
    case 'heic':
    case 'heif': {
      try {
        const { HeicCodec } = await import('../codecs/heic/heic-codec');
        const codec = new HeicCodec();
        await codec.init?.();
        codecs.set('heic' as ImageFormat, codec);
        codecs.set('heif' as ImageFormat, codec);
      } catch (error) {
        console.error('[worker] Failed to load HEIC codec:', error);
        throw error;
      }
      break;
    }
    case 'avif': {
      try {
        const { AvifCodec } = await import('../codecs/avif/avif-codec');
        const codec = new AvifCodec();
        await codec.init?.();
        codecs.set('avif' as ImageFormat, codec);
      } catch (error) {
        console.error('[worker] Failed to load AVIF codec:', error);
        throw error;
      }
      break;
    }
    default:
      // No WASM codec needed for natively-supported formats
      break;
  }
}

// ─── Message Handler ───────────────────────────────────────────

/**
 * Handle incoming messages from the main thread.
 */
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  switch (request.type) {
    case 'decode':
      await handleDecode(request.id, request.buffer, request.format, request.options);
      break;

    case 'init-codec':
      await handleInitCodec(request.id, request.format);
      break;

    case 'dispose':
      handleDispose();
      break;
  }
});

/**
 * Handle a decode request.
 */
async function handleDecode(
  id: string,
  buffer: ArrayBuffer,
  format: ImageFormat,
  options?: DecodeOptions,
): Promise<void> {
  try {
    // Re-detect format if Unknown (belt-and-suspenders)
    let resolvedFormat = format;
    if (resolvedFormat === 'unknown') {
      resolvedFormat = detectFormat(buffer);
    }

    const codec = await ensureCodec(resolvedFormat);
    if (!codec) {
      respond({
        type: 'decode-error',
        id,
        error: {
          code: 'CODEC_NOT_FOUND',
          message: `No WASM codec available for format: ${resolvedFormat}`,
        },
      });
      return;
    }

    const decoded: DecodedImage = await codec.decode(buffer, options);
    const { data: transferable, transfer } = toTransferable(decoded);

    // Use postMessage with transfer list for zero-copy
    (self as any).postMessage(
      { type: 'decode-result', id, image: transferable } satisfies WorkerResponse,
      transfer,
    );
  } catch (error) {
    respond({
      type: 'decode-error',
      id,
      error: serializeError(error),
    });
  }
}

/**
 * Handle a codec init request (pre-warm).
 */
async function handleInitCodec(id: string, format: ImageFormat): Promise<void> {
  try {
    const codec = await ensureCodec(format);
    respond({
      type: 'init-result',
      id,
      success: codec !== null,
    });
  } catch (error) {
    respond({
      type: 'init-result',
      id,
      success: false,
      error: serializeError(error),
    });
  }
}

/**
 * Handle dispose request — clean up codecs.
 */
function handleDispose(): void {
  for (const codec of codecs.values()) {
    codec.dispose?.();
  }
  codecs.clear();
}

/**
 * Send a response to the main thread.
 */
function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

// Signal ready
respond({ type: 'ready' });
