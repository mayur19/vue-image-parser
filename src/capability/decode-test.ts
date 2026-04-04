/**
 * DecodeTestRunner — Pixel-level decode verification engine.
 * 
 * This is the core of the capability detection system.
 * It takes a ProbeAsset, decodes it using the browser's native decoder,
 * then reads back pixel data via Canvas and compares against known-correct values.
 *
 * Pipeline:
 * 1. Create Blob from base64 probe bytes
 * 2. Call createImageBitmap(blob) with timeout
 * 3. Check width/height match expected dimensions
 * 4. Draw to Canvas, read pixel data via getImageData()
 * 5. Compare each pixel against expected values within tolerance
 * 6. Compute SupportLevel from pixel accuracy + decode time
 */

import type { ProbeAsset, DecodeProbeResult, PixelComparisonResult } from '../types/capability';
import { SupportLevel, FormatFeature } from '../types/capability';
import { base64ToBlob } from '../utils/buffer';
import { hasCreateImageBitmap, hasOffscreenCanvas } from '../utils/ssr';

/**
 * Default timeout for a single probe attempt (milliseconds).
 */
const DEFAULT_PROBE_TIMEOUT = 5000;

/**
 * Default performance threshold — decode time above this
 * means PARTIAL_SUPPORT even if pixels are correct.
 */
const DEFAULT_PERF_THRESHOLD_MS = 100;

/**
 * Run a pixel-verified decode probe for a single ProbeAsset.
 *
 * @param asset - The probe image with expected pixel values
 * @param options - Optional timeout and performance threshold
 * @returns Detailed probe result including pixel comparisons
 */
export async function runDecodeTest(
  asset: ProbeAsset,
  options: { timeout?: number; performanceThresholdMs?: number } = {},
): Promise<DecodeProbeResult> {
  const timeout = options.timeout ?? DEFAULT_PROBE_TIMEOUT;
  const perfThreshold = options.performanceThresholdMs ?? DEFAULT_PERF_THRESHOLD_MS;

  const startTime = performance.now();

  // Check if createImageBitmap is available
  if (!hasCreateImageBitmap()) {
    return createFailResult(asset, startTime, 'createImageBitmap not available');
  }

  try {
    // Step 1: Create Blob from probe bytes
    const blob = base64ToBlob(asset.base64, asset.mimeType);

    // Step 2: Attempt native decode with timeout
    const bitmap = await promiseWithTimeout(
      createImageBitmap(blob),
      timeout,
      `Decode timed out after ${timeout}ms`,
    );

    const decodeTimeMs = performance.now() - startTime;

    // Step 3: Check dimensions
    if (bitmap.width === 0 || bitmap.height === 0) {
      bitmap.close();
      return createResult(asset, {
        loadSucceeded: true,
        dimensionsMatch: false,
        pixelResults: [],
        pixelAccuracy: 0,
        decodeTimeMs,
        support: SupportLevel.NO_SUPPORT,
        diagnostic: `Decoded to 0×0 bitmap (createImageBitmap returned empty)`,
        startTime,
      });
    }

    const dimensionsMatch =
      bitmap.width === asset.expectedWidth &&
      bitmap.height === asset.expectedHeight;

    if (!dimensionsMatch) {
      bitmap.close();
      return createResult(asset, {
        loadSucceeded: true,
        dimensionsMatch: false,
        pixelResults: [],
        pixelAccuracy: 0,
        decodeTimeMs,
        support: SupportLevel.NO_SUPPORT,
        diagnostic: `Dimension mismatch: expected ${asset.expectedWidth}×${asset.expectedHeight}, got ${bitmap.width}×${bitmap.height}`,
        startTime,
      });
    }

    // Step 4: Read pixel data via Canvas
    const pixelData = readPixelsFromBitmap(bitmap, asset.expectedWidth, asset.expectedHeight);
    bitmap.close();

    if (!pixelData) {
      return createResult(asset, {
        loadSucceeded: true,
        dimensionsMatch: true,
        pixelResults: [],
        pixelAccuracy: 0,
        decodeTimeMs,
        support: SupportLevel.NO_SUPPORT,
        diagnostic: 'Failed to read pixel data from canvas',
        startTime,
      });
    }

    // Step 5: Compare pixels
    const pixelResults = comparePixels(pixelData, asset);

    // Step 6: Compute accuracy and support level
    const passingPixels = pixelResults.filter(r => r.passes).length;
    const pixelAccuracy = pixelResults.length > 0 ? passingPixels / pixelResults.length : 0;

    let support: SupportLevel;
    let diagnostic: string;

    if (pixelAccuracy === 1.0) {
      // All pixels match — check performance
      if (decodeTimeMs > perfThreshold) {
        support = SupportLevel.PARTIAL_SUPPORT;
        diagnostic = `Pixels correct but decode slow (${decodeTimeMs.toFixed(1)}ms > ${perfThreshold}ms threshold)`;
      } else {
        support = SupportLevel.FULL_SUPPORT;
        diagnostic = `All ${pixelResults.length} pixels match within tolerance (${decodeTimeMs.toFixed(1)}ms)`;
      }
    } else if (pixelAccuracy > 0) {
      support = SupportLevel.PARTIAL_SUPPORT;
      diagnostic = `${passingPixels}/${pixelResults.length} pixels match (${(pixelAccuracy * 100).toFixed(0)}% accuracy)`;
    } else {
      support = SupportLevel.NO_SUPPORT;
      diagnostic = `No pixels match expected values (0% accuracy)`;
    }

    return createResult(asset, {
      loadSucceeded: true,
      dimensionsMatch: true,
      pixelResults,
      pixelAccuracy,
      decodeTimeMs,
      support,
      diagnostic,
      startTime,
    });
  } catch (error) {
    const decodeTimeMs = performance.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return createResult(asset, {
      loadSucceeded: false,
      dimensionsMatch: false,
      pixelResults: [],
      pixelAccuracy: 0,
      decodeTimeMs,
      support: SupportLevel.NO_SUPPORT,
      diagnostic: `Native decode failed: ${message}`,
      startTime,
    });
  }
}

/**
 * Read RGBA pixel data from an ImageBitmap using Canvas.
 */
function readPixelsFromBitmap(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Uint8ClampedArray | null {
  try {
    if (hasOffscreenCanvas()) {
      // Prefer OffscreenCanvas (no DOM dependency, works in workers too)
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, width, height).data;
    } else {
      // Fallback to regular Canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, width, height).data;
    }
  } catch {
    return null;
  }
}

/**
 * Compare actual pixel data against expected values from the probe asset.
 */
function comparePixels(
  pixelData: Uint8ClampedArray,
  asset: ProbeAsset,
): PixelComparisonResult[] {
  const results: PixelComparisonResult[] = [];

  for (const expected of asset.expectedPixels) {
    const offset = (expected.y * asset.expectedWidth + expected.x) * 4;

    if (offset + 3 >= pixelData.length) {
      results.push({
        x: expected.x,
        y: expected.y,
        expected: { r: expected.r, g: expected.g, b: expected.b, a: expected.a },
        actual: { r: 0, g: 0, b: 0, a: 0 },
        maxDelta: 255,
        passes: false,
      });
      continue;
    }

    const actual = {
      r: pixelData[offset],
      g: pixelData[offset + 1],
      b: pixelData[offset + 2],
      a: pixelData[offset + 3],
    };

    const maxDelta = Math.max(
      Math.abs(expected.r - actual.r),
      Math.abs(expected.g - actual.g),
      Math.abs(expected.b - actual.b),
      Math.abs(expected.a - actual.a),
    );

    results.push({
      x: expected.x,
      y: expected.y,
      expected: { r: expected.r, g: expected.g, b: expected.b, a: expected.a },
      actual,
      maxDelta,
      passes: maxDelta <= asset.tolerance,
    });
  }

  return results;
}

/**
 * Wrap a promise with a timeout.
 */
function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Helper to create a fail result.
 */
function createFailResult(
  asset: ProbeAsset,
  startTime: number,
  diagnostic: string,
): DecodeProbeResult {
  return createResult(asset, {
    loadSucceeded: false,
    dimensionsMatch: false,
    pixelResults: [],
    pixelAccuracy: 0,
    decodeTimeMs: performance.now() - startTime,
    support: SupportLevel.NO_SUPPORT,
    diagnostic,
    startTime,
  });
}

/**
 * Helper to construct a DecodeProbeResult.
 */
function createResult(
  asset: ProbeAsset,
  data: {
    loadSucceeded: boolean;
    dimensionsMatch: boolean;
    pixelResults: PixelComparisonResult[];
    pixelAccuracy: number;
    decodeTimeMs: number;
    support: SupportLevel;
    diagnostic: string;
    startTime: number;
  },
): DecodeProbeResult {
  return {
    format: asset.format,
    feature: asset.feature,
    loadSucceeded: data.loadSucceeded,
    dimensionsMatch: data.dimensionsMatch,
    pixelResults: data.pixelResults,
    pixelAccuracy: data.pixelAccuracy,
    decodeTimeMs: data.decodeTimeMs,
    support: data.support,
    diagnostic: data.diagnostic,
    timestamp: Date.now(),
  };
}
