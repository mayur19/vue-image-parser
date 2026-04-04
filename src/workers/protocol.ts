/**
 * Worker message serialization/deserialization protocol.
 * Handles conversion between Error objects and JSON-serializable format.
 */

import type { SerializedError, TransferableDecodedImage, WorkerRequest, WorkerResponse } from '../types/worker';
import type { DecodedImage, ImageFormat } from '../types/image';

/**
 * Serialize an Error into a transferable format for postMessage.
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      code: (error as any).code ?? 'UNKNOWN',
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    code: 'UNKNOWN',
    message: String(error),
  };
}

/**
 * Deserialize a SerializedError back into an Error object.
 */
export function deserializeError(serialized: SerializedError): Error {
  const error = new Error(serialized.message);
  (error as any).code = serialized.code;
  if (serialized.stack) error.stack = serialized.stack;
  return error;
}

/**
 * Convert a DecodedImage to a TransferableDecodedImage for postMessage.
 * The pixel data ArrayBuffer is extracted so it can be listed in the transfer list.
 */
export function toTransferable(image: DecodedImage): { data: TransferableDecodedImage; transfer: Transferable[] } {
  const buffer = image.data.buffer as ArrayBuffer;
  return {
    data: {
      data: buffer,
      width: image.width,
      height: image.height,
      format: image.format,
      orientation: image.orientation,
      decodePath: image.decodePath,
    },
    transfer: [buffer],
  };
}

/**
 * Convert a TransferableDecodedImage back into a DecodedImage.
 */
export function fromTransferable(transferred: TransferableDecodedImage): DecodedImage {
  const data = new Uint8ClampedArray(transferred.data);
  let disposed = false;

  return {
    data,
    width: transferred.width,
    height: transferred.height,
    format: transferred.format as ImageFormat,
    orientation: transferred.orientation,
    decodePath: transferred.decodePath,
    dispose() {
      if (disposed) return;
      disposed = true;
      // Let GC reclaim the buffer
    },
  };
}

/**
 * Extract transferable objects from a WorkerRequest for zero-copy posting.
 */
export function getRequestTransferables(request: WorkerRequest): Transferable[] {
  if (request.type === 'decode') {
    return [request.buffer];
  }
  return [];
}

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
