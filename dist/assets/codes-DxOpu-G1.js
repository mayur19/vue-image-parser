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
class CodecError extends ImageParserError {
  constructor() {
    super(...arguments);
    this.name = "CodecError";
  }
}
const ErrorCodes = {
  // Codec errors
  CODEC_INIT_FAILED: "CODEC_INIT_FAILED",
  HEIC_DECODE_FAILED: "HEIC_DECODE_FAILED",
  AVIF_DECODE_FAILED: "AVIF_DECODE_FAILED"
};
export {
  CodecError as C,
  ErrorCodes as E
};
//# sourceMappingURL=codes-DxOpu-G1.js.map
