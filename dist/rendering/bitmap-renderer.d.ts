import { DecodedImage } from '../types/image';

/**
 * Convert a DecodedImage to an ImageBitmap for efficient rendering.
 * Returns null if ImageBitmap is not available.
 */
export declare function toImageBitmap(image: DecodedImage): Promise<ImageBitmap | null>;
/**
 * Create a data URL from decoded image data.
 * Useful for setting as <img> src attribute.
 */
export declare function toDataURL(image: DecodedImage, mimeType?: string): string;
/**
 * Create a Blob URL from decoded image data.
 * More memory-efficient than data URLs for large images.
 * Remember to call URL.revokeObjectURL() when done.
 */
export declare function toBlobURL(image: DecodedImage, mimeType?: string): Promise<string>;
//# sourceMappingURL=bitmap-renderer.d.ts.map