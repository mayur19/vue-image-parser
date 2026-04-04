/**
 * ArrayBuffer utility functions.
 */
/**
 * Convert a base64 string to an ArrayBuffer.
 */
export declare function base64ToArrayBuffer(base64: string): ArrayBuffer;
/**
 * Convert an ArrayBuffer to a base64 string.
 */
export declare function arrayBufferToBase64(buffer: ArrayBuffer): string;
/**
 * Create a Blob from a base64 string with the given MIME type.
 */
export declare function base64ToBlob(base64: string, mimeType: string): Blob;
/**
 * Read a Blob or File into an ArrayBuffer.
 */
export declare function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer>;
/**
 * Concatenate multiple ArrayBuffers into one.
 */
export declare function concatBuffers(...buffers: ArrayBuffer[]): ArrayBuffer;
//# sourceMappingURL=buffer.d.ts.map