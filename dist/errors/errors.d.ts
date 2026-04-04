import { ErrorCode } from './codes';

/**
 * Base error class for all library errors.
 */
export declare class ImageParserError extends Error {
    readonly code: ErrorCode;
    readonly cause?: unknown | undefined;
    name: string;
    constructor(code: ErrorCode, message: string, cause?: unknown | undefined);
    /**
     * Serialize for transfer across worker boundaries.
     */
    toJSON(): {
        code: string;
        message: string;
        stack?: string;
    };
}
/**
 * Format detection failed — couldn't identify the image format.
 */
export declare class FormatDetectionError extends ImageParserError {
    name: string;
}
/**
 * Codec-level decode failure.
 */
export declare class CodecError extends ImageParserError {
    name: string;
}
/**
 * Web Worker crashed or communication failure.
 */
export declare class WorkerError extends ImageParserError {
    name: string;
}
/**
 * Network fetch failure.
 */
export declare class FetchError extends ImageParserError {
    name: string;
}
/**
 * Operation exceeded timeout.
 */
export declare class TimeoutError extends ImageParserError {
    name: string;
}
/**
 * Operation was aborted via AbortController.
 */
export declare class AbortError extends ImageParserError {
    name: string;
    constructor(message?: string);
}
/**
 * Capability detection probe failure.
 */
export declare class ProbeError extends ImageParserError {
    name: string;
}
//# sourceMappingURL=errors.d.ts.map