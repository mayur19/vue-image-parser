/**
 * Image scaling utilities.
 * Handles downsampling for large images and dimension calculations.
 */
/**
 * Calculate scaled dimensions that fit within maxDimension
 * while preserving aspect ratio.
 */
export declare function scaleDimensions(width: number, height: number, maxDimension: number): {
    width: number;
    height: number;
    scale: number;
};
/**
 * Calculate dimensions for object-fit rendering.
 */
export declare function calculateFitDimensions(srcWidth: number, srcHeight: number, containerWidth: number, containerHeight: number, fit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'): {
    x: number;
    y: number;
    width: number;
    height: number;
};
//# sourceMappingURL=scaler.d.ts.map