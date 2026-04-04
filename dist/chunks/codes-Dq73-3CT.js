var ImageFormat = /* @__PURE__ */ ((ImageFormat2) => {
  ImageFormat2["JPEG"] = "jpeg";
  ImageFormat2["PNG"] = "png";
  ImageFormat2["WebP"] = "webp";
  ImageFormat2["GIF"] = "gif";
  ImageFormat2["HEIC"] = "heic";
  ImageFormat2["HEIF"] = "heif";
  ImageFormat2["AVIF"] = "avif";
  ImageFormat2["Unknown"] = "unknown";
  return ImageFormat2;
})(ImageFormat || {});
const UNIVERSALLY_SUPPORTED_FORMATS = /* @__PURE__ */ new Set([
  "jpeg",
  "png",
  "gif"
  /* GIF */
]);
class ImageParserError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = "ImageParserError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
  /**
   * Serialize for transfer across worker boundaries.
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      stack: this.stack
    };
  }
}
class FormatDetectionError extends ImageParserError {
  constructor() {
    super(...arguments);
    this.name = "FormatDetectionError";
  }
}
class CodecError extends ImageParserError {
  constructor() {
    super(...arguments);
    this.name = "CodecError";
  }
}
class WorkerError extends ImageParserError {
  constructor() {
    super(...arguments);
    this.name = "WorkerError";
  }
}
class FetchError extends ImageParserError {
  constructor() {
    super(...arguments);
    this.name = "FetchError";
  }
}
class TimeoutError extends ImageParserError {
  constructor() {
    super(...arguments);
    this.name = "TimeoutError";
  }
}
class AbortError extends ImageParserError {
  constructor(message = "Operation aborted") {
    super("ABORTED", message);
    this.name = "AbortError";
  }
}
const ErrorCodes = {
  // Format detection
  FORMAT_DETECTION_FAILED: "FORMAT_DETECTION_FAILED",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  // Codec errors
  CODEC_INIT_FAILED: "CODEC_INIT_FAILED",
  CODEC_NOT_FOUND: "CODEC_NOT_FOUND",
  DECODE_FAILED: "DECODE_FAILED",
  HEIC_DECODE_FAILED: "HEIC_DECODE_FAILED",
  AVIF_DECODE_FAILED: "AVIF_DECODE_FAILED",
  // Worker errors
  WORKER_CRASHED: "WORKER_CRASHED",
  WORKER_TIMEOUT: "WORKER_TIMEOUT",
  WORKER_POOL_EXHAUSTED: "WORKER_POOL_EXHAUSTED",
  // Network errors
  FETCH_FAILED: "FETCH_FAILED",
  FETCH_TIMEOUT: "FETCH_TIMEOUT",
  INCOMPLETE_BUFFER: "INCOMPLETE_BUFFER",
  // Capability errors
  PROBE_TIMEOUT: "PROBE_TIMEOUT",
  PROBE_FAILED: "PROBE_FAILED",
  NATIVE_DECODE_FAILED: "NATIVE_DECODE_FAILED",
  // General
  ABORTED: "ABORTED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_INPUT: "INVALID_INPUT",
  RENDER_FAILED: "RENDER_FAILED",
  SSR_NOT_SUPPORTED: "SSR_NOT_SUPPORTED"
};
export {
  AbortError as A,
  CodecError as C,
  ErrorCodes as E,
  FetchError as F,
  ImageFormat as I,
  TimeoutError as T,
  UNIVERSALLY_SUPPORTED_FORMATS as U,
  WorkerError as W,
  ImageParserError as a,
  FormatDetectionError as b
};
//# sourceMappingURL=codes-Dq73-3CT.js.map
