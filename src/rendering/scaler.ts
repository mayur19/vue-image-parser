/**
 * Image scaling utilities.
 * Handles downsampling for large images and dimension calculations.
 */

/**
 * Calculate scaled dimensions that fit within maxDimension
 * while preserving aspect ratio.
 */
export function scaleDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number; scale: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height, scale: 1 };
  }

  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    scale,
  };
}

/**
 * Calculate dimensions for object-fit rendering.
 */
export function calculateFitDimensions(
  srcWidth: number,
  srcHeight: number,
  containerWidth: number,
  containerHeight: number,
  fit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down',
): { x: number; y: number; width: number; height: number } {
  switch (fit) {
    case 'fill':
      return { x: 0, y: 0, width: containerWidth, height: containerHeight };

    case 'none':
      return {
        x: (containerWidth - srcWidth) / 2,
        y: (containerHeight - srcHeight) / 2,
        width: srcWidth,
        height: srcHeight,
      };

    case 'contain': {
      const scale = Math.min(containerWidth / srcWidth, containerHeight / srcHeight);
      const w = srcWidth * scale;
      const h = srcHeight * scale;
      return {
        x: (containerWidth - w) / 2,
        y: (containerHeight - h) / 2,
        width: w,
        height: h,
      };
    }

    case 'cover': {
      const scale = Math.max(containerWidth / srcWidth, containerHeight / srcHeight);
      const w = srcWidth * scale;
      const h = srcHeight * scale;
      return {
        x: (containerWidth - w) / 2,
        y: (containerHeight - h) / 2,
        width: w,
        height: h,
      };
    }

    case 'scale-down': {
      // Same as contain, but never scale up
      if (srcWidth <= containerWidth && srcHeight <= containerHeight) {
        return {
          x: (containerWidth - srcWidth) / 2,
          y: (containerHeight - srcHeight) / 2,
          width: srcWidth,
          height: srcHeight,
        };
      }
      const scale = Math.min(containerWidth / srcWidth, containerHeight / srcHeight);
      const w = srcWidth * scale;
      const h = srcHeight * scale;
      return {
        x: (containerWidth - w) / 2,
        y: (containerHeight - h) / 2,
        width: w,
        height: h,
      };
    }
  }
}
