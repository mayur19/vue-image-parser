/**
 * Error class hierarchy for the vue-image-parser library.
 * All errors extend ImageParserError and include a machine-readable code.
 */

import type { ErrorCode } from './codes';

/**
 * Base error class for all library errors.
 */
export class ImageParserError extends Error {
  public override name = 'ImageParserError';

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize for transfer across worker boundaries.
   */
  toJSON(): { code: string; message: string; stack?: string } {
    return {
      code: this.code,
      message: this.message,
      stack: this.stack,
    };
  }
}

/**
 * Format detection failed — couldn't identify the image format.
 */
export class FormatDetectionError extends ImageParserError {
  public override name = 'FormatDetectionError';
}

/**
 * Codec-level decode failure.
 */
export class CodecError extends ImageParserError {
  public override name = 'CodecError';
}

/**
 * Web Worker crashed or communication failure.
 */
export class WorkerError extends ImageParserError {
  public override name = 'WorkerError';
}

/**
 * Network fetch failure.
 */
export class FetchError extends ImageParserError {
  public override name = 'FetchError';
}

/**
 * Operation exceeded timeout.
 */
export class TimeoutError extends ImageParserError {
  public override name = 'TimeoutError';
}

/**
 * Operation was aborted via AbortController.
 */
export class AbortError extends ImageParserError {
  public override name = 'AbortError';

  constructor(message = 'Operation aborted') {
    super('ABORTED', message);
  }
}

/**
 * Capability detection probe failure.
 */
export class ProbeError extends ImageParserError {
  public override name = 'ProbeError';
}
