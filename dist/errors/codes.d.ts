/**
 * Error code constants.
 * Every error in the library has a unique code for programmatic handling.
 */
export declare const ErrorCodes: {
    readonly FORMAT_DETECTION_FAILED: "FORMAT_DETECTION_FAILED";
    readonly UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT";
    readonly CODEC_INIT_FAILED: "CODEC_INIT_FAILED";
    readonly CODEC_NOT_FOUND: "CODEC_NOT_FOUND";
    readonly DECODE_FAILED: "DECODE_FAILED";
    readonly HEIC_DECODE_FAILED: "HEIC_DECODE_FAILED";
    readonly AVIF_DECODE_FAILED: "AVIF_DECODE_FAILED";
    readonly WORKER_CRASHED: "WORKER_CRASHED";
    readonly WORKER_TIMEOUT: "WORKER_TIMEOUT";
    readonly WORKER_POOL_EXHAUSTED: "WORKER_POOL_EXHAUSTED";
    readonly FETCH_FAILED: "FETCH_FAILED";
    readonly FETCH_TIMEOUT: "FETCH_TIMEOUT";
    readonly INCOMPLETE_BUFFER: "INCOMPLETE_BUFFER";
    readonly PROBE_TIMEOUT: "PROBE_TIMEOUT";
    readonly PROBE_FAILED: "PROBE_FAILED";
    readonly NATIVE_DECODE_FAILED: "NATIVE_DECODE_FAILED";
    readonly ABORTED: "ABORTED";
    readonly FILE_TOO_LARGE: "FILE_TOO_LARGE";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly RENDER_FAILED: "RENDER_FAILED";
    readonly SSR_NOT_SUPPORTED: "SSR_NOT_SUPPORTED";
};
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
//# sourceMappingURL=codes.d.ts.map