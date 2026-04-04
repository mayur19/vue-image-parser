/**
 * loadImage() — The primary decode pipeline orchestrator.
 *
 * Pipeline:
 * 1. Resolve source → ArrayBuffer
 * 2. Detect format (magic bytes + ftyp)
 * 3. Query CapabilityRegistry for native vs WASM recommendation
 * 4. Route to native or WASM codec
 * 5. Handle EXIF orientation
 * 6. Return DecodedImage
 */

import type { DecodedImage, ImageFormat } from '../types/image';
import type { LoadOptions } from '../types/options';
import { ImageFormat as Format, UNIVERSALLY_SUPPORTED_FORMATS } from '../types/image';
import { detectFormat } from '../detection/detect';
import { getCapabilityRegistry } from '../capability/capability-registry';
import { NativeCodec } from '../codecs/native-codec';
import { WorkerPool } from '../workers/pool';
import type { WorkerResponse } from '../types/worker';
import { fromTransferable, generateRequestId, deserializeError } from '../workers/protocol';
import { TaskPriority } from '../workers/task-queue';
import { fetchAsArrayBuffer } from '../utils/fetch';
import { blobToArrayBuffer } from '../utils/buffer';
import { readExifOrientation, applyOrientation } from '../rendering/exif';
import { ImageParserError, FormatDetectionError, CodecError, AbortError } from '../errors/errors';
import { ErrorCodes } from '../errors/codes';
import { isBrowser, hasWorkerSupport } from '../utils/ssr';

// ─── Singleton Pool & Codec ────────────────────────────────────

let workerPool: WorkerPool | null = null;
let nativeCodec: NativeCodec | null = null;

function getWorkerPool(): WorkerPool {
  if (!workerPool) {
    workerPool = new WorkerPool();
  }
  return workerPool;
}

function getNativeCodec(): NativeCodec {
  if (!nativeCodec) {
    nativeCodec = new NativeCodec();
    // Wire up the failure feedback to capability detection
    nativeCodec.onDecodeFailure = (format, error) => {
      getCapabilityRegistry().onNativeDecodeFailure(format, error);
    };
  }
  return nativeCodec;
}

/**
 * Load and decode an image from any source.
 *
 * @param source - URL string, File, Blob, or ArrayBuffer
 * @param options - Loading options (abort, timeout, strategy override)
 * @returns Decoded image with normalized RGBA pixel data
 *
 * @throws FormatDetectionError if the format cannot be identified
 * @throws CodecError if decoding fails
 * @throws AbortError if cancelled via AbortSignal
 */
export async function loadImage(
  source: string | File | Blob | ArrayBuffer,
  options: LoadOptions = {},
): Promise<DecodedImage> {
  const {
    signal,
    timeout = 30000,
    strategy = 'auto',
    maxDimension,
    autoOrient = true,
    onProgress,
  } = options;

  // Check abort before starting
  if (signal?.aborted) {
    throw new AbortError();
  }

  // Step 1: Resolve source to ArrayBuffer
  const buffer = await resolveSource(source, { signal, timeout, onProgress });

  if (signal?.aborted) throw new AbortError();

  // Step 2: Detect format
  const format = detectFormat(buffer);
  if (format === Format.Unknown) {
    throw new FormatDetectionError(
      ErrorCodes.FORMAT_DETECTION_FAILED,
      'Could not identify image format from binary signature',
    );
  }

  // Step 3: Determine decode path
  let decodePath: 'native' | 'wasm';

  if (strategy === 'native') {
    decodePath = 'native';
  } else if (strategy === 'wasm') {
    decodePath = 'wasm';
  } else {
    // 'auto' — consult capability registry
    const capability = getCapabilityRegistry();
    const resolved = await capability.resolve(format);
    decodePath = resolved === 'use_native' ? 'native' : 'wasm';
  }

  if (signal?.aborted) throw new AbortError();

  // Step 4: Decode
  let decoded: DecodedImage;

  if (decodePath === 'native') {
    decoded = await decodeNative(buffer, format, { maxDimension });
  } else {
    decoded = await decodeViaWorker(buffer, format, signal, { maxDimension });
  }

  // Step 5: EXIF orientation (JPEG only, and only if autoOrient is enabled)
  if (autoOrient && format === Format.JPEG) {
    const orientation = readExifOrientation(buffer);
    if (orientation !== 1) {
      const oriented = applyOrientation(decoded.data, decoded.width, decoded.height, orientation);
      const original = decoded;
      decoded = {
        ...decoded,
        data: oriented.data,
        width: oriented.width,
        height: oriented.height,
        orientation: 1,
      };
      original.dispose();
    }
  }

  // Override format in result (native codec returns Unknown)
  if ((decoded as any).format === Format.Unknown || !(decoded as any).format) {
    decoded = { ...decoded, format, decodePath };
  }

  return decoded;
}

/**
 * Dispose global resources (worker pool, codecs).
 */
export function disposeEngine(): void {
  workerPool?.dispose();
  workerPool = null;
  nativeCodec = null;
}

/**
 * Pre-initialize WASM codecs for the given formats.
 * Call early (e.g., on app mount) to avoid cold-start latency on first decode.
 * Non-fatal — if warmup fails, the first decode pays the init cost (current behavior).
 */
export async function warmup(formats: ImageFormat[]): Promise<void> {
  if (!hasWorkerSupport()) return;

  const pool = getWorkerPool();
  await pool.warmup(formats);
}

// ─── Private Helpers ───────────────────────────────────────────

/**
 * Resolve any source type to an ArrayBuffer.
 */
async function resolveSource(
  source: string | File | Blob | ArrayBuffer,
  options: { signal?: AbortSignal; timeout?: number; onProgress?: (p: number) => void },
): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) {
    return source;
  }

  if (source instanceof Blob) {
    return blobToArrayBuffer(source);
  }

  if (typeof source === 'string') {
    // URL or data URI
    return fetchAsArrayBuffer(source, options);
  }

  throw new ImageParserError(
    ErrorCodes.INVALID_INPUT,
    `Invalid image source type: ${typeof source}`,
  );
}

/**
 * Decode using native browser codec (createImageBitmap).
 */
async function decodeNative(
  buffer: ArrayBuffer,
  format: ImageFormat,
  options: { maxDimension?: number },
): Promise<DecodedImage> {
  const codec = getNativeCodec();

  try {
    const decoded = await codec.decode(buffer, {
      maxDimension: options.maxDimension,
    });
    return { ...decoded, format };
  } catch (error) {
    // Native decode failed — report and fall through to WASM
    if (typeof console !== 'undefined') {
      console.warn(`[vue-image-parser] Native decode failed for ${format}, falling back to WASM`);
    }

    // Report failure to capability system
    getCapabilityRegistry().onNativeDecodeFailure(
      format,
      error instanceof Error ? error : new Error(String(error)),
    );

    // Try WASM fallback
    if (hasWorkerSupport()) {
      return decodeViaWorker(buffer, format, undefined, options);
    }

    throw error;
  }
}

/**
 * Decode via Web Worker using WASM codec.
 */
async function decodeViaWorker(
  buffer: ArrayBuffer,
  format: ImageFormat,
  signal?: AbortSignal,
  _options?: { maxDimension?: number },
): Promise<DecodedImage> {
  if (!hasWorkerSupport()) {
    throw new CodecError(
      ErrorCodes.WORKER_CRASHED,
      'Web Workers required for WASM decoding but not available',
    );
  }

  const pool = getWorkerPool();
  const id = generateRequestId();

  const response: WorkerResponse = await pool.submit(
    {
      type: 'decode',
      id,
      buffer,
      format,
      maxDimension: _options?.maxDimension,
    },
    TaskPriority.HIGH,
    signal,
  );

  if (response.type === 'decode-error') {
    throw deserializeError(response.error);
  }

  if (response.type === 'decode-result') {
    return fromTransferable(response.image);
  }

  throw new CodecError(
    ErrorCodes.DECODE_FAILED,
    `Unexpected worker response type: ${response.type}`,
  );
}
