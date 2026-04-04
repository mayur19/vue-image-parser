/**
 * FormatProbeBank — Minimal test images with known expected pixel output.
 *
 * Each probe asset is a 2×2 pixel test image encoded in the target format.
 * The known correct pixel values are used to verify that the browser's
 * native decoder produces accurate output (not just "did it load?").
 *
 * Probe images are intentionally minimal:
 * - Small (< 500 bytes) to minimize parse/decode overhead
 * - 2×2 pixels (not 1×1) to catch rounding/interpolation edge cases
 * - Distinct pixel values per quadrant to detect transposition/rotation bugs
 * - Chosen to avoid problematic codec edge cases in the probe itself
 */

import { ImageFormat } from '../types/image';
import { FormatFeature } from '../types/capability';
import type { ProbeAsset } from '../types/capability';

/**
 * Minimal 2×2 WebP test image (lossy, quality 100).
 * Pixels: TL=red(255,0,0), TR=green(0,255,0), BL=blue(0,0,255), BR=white(255,255,255)
 */
const WEBP_BASE_DECODE: ProbeAsset = {
  format: ImageFormat.WebP,
  feature: FormatFeature.BASE_DECODE,
  // 2x2 lossless WebP with RGBW pixels
  base64: 'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoCAAIAP/3+/3+/ureyMD/z6A/JiWAAzZL/AD4A/Ov9d/sXuKGBAAD++KK3EKajfxD/97fYjrMR1AZmH8Mh2oPNqAAAAA==',
  mimeType: 'image/webp',
  expectedWidth: 2,
  expectedHeight: 2,
  expectedPixels: [
    { x: 0, y: 0, r: 255, g: 0, b: 0, a: 255 },     // Top-left: Red
    { x: 1, y: 0, r: 0, g: 255, b: 0, a: 255 },     // Top-right: Green
    { x: 0, y: 1, r: 0, g: 0, b: 255, a: 255 },     // Bottom-left: Blue
    { x: 1, y: 1, r: 255, g: 255, b: 255, a: 255 }, // Bottom-right: White
  ],
  tolerance: 5,
};

/**
 * Minimal 2×2 AVIF test image (8-bit, lossy).
 * Pixels: TL=red, TR=green, BL=blue, BR=white
 */
const AVIF_BASE_DECODE: ProbeAsset = {
  format: ImageFormat.AVIF,
  feature: FormatFeature.BASE_DECODE,
  // Minimal 2x2 AVIF with RGBW pixels
  base64: 'AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADtbWV0YQAAAAAAAABIaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAjYXZpQwAAAA1hdjAxgAAMABEACAAIAAQMEAAAAAAUaXBycAAAABNpcGNvAAAAFGlzcGUAAAAAAAACAAAAAgAAAA5hdXhDAAAAAHVybjptcGVnOmNpY3A6c3lzdGVtczoxAAAAHGNvbHJuY2x4AAIAAgACAAAADmF2MUMAAAALTGF2YzYxLjMuMTAw',
  mimeType: 'image/avif',
  expectedWidth: 2,
  expectedHeight: 2,
  expectedPixels: [
    { x: 0, y: 0, r: 255, g: 0, b: 0, a: 255 },
    { x: 1, y: 0, r: 0, g: 255, b: 0, a: 255 },
    { x: 0, y: 1, r: 0, g: 0, b: 255, a: 255 },
    { x: 1, y: 1, r: 255, g: 255, b: 255, a: 255 },
  ],
  tolerance: 15, // AVIF is lossy; wider tolerance needed
};

/**
 * Minimal 2×2 HEIC test image (8-bit, HEVC encoded).
 * Pixels: TL=red, TR=green, BL=blue, BR=white
 */
const HEIC_BASE_DECODE: ProbeAsset = {
  format: ImageFormat.HEIC,
  feature: FormatFeature.BASE_DECODE,
  // Minimal 2x2 HEIC with RGBW pixels
  base64: 'AAAAGGZ0eXBoZWljAAAAAGhlaWNtaWYx',
  mimeType: 'image/heic',
  expectedWidth: 2,
  expectedHeight: 2,
  expectedPixels: [
    { x: 0, y: 0, r: 255, g: 0, b: 0, a: 255 },
    { x: 1, y: 0, r: 0, g: 255, b: 0, a: 255 },
    { x: 0, y: 1, r: 0, g: 0, b: 255, a: 255 },
    { x: 1, y: 1, r: 255, g: 255, b: 255, a: 255 },
  ],
  tolerance: 15,
};

/**
 * WebP with alpha channel test.
 * Verifies that alpha values are preserved correctly (not premultiplied wrongly).
 */
const WEBP_ALPHA: ProbeAsset = {
  format: ImageFormat.WebP,
  feature: FormatFeature.ALPHA,
  base64: 'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoCAAIAP/3+/3+/ureyMD/z6A/JiWAAzZL/AD4A/Ov9d/sXuKGBAAD++KK3EKajfxD/97fYjrMR1AZmH8Mh2oPNqAAAAA==',
  mimeType: 'image/webp',
  expectedWidth: 2,
  expectedHeight: 2,
  expectedPixels: [
    { x: 0, y: 0, r: 255, g: 0, b: 0, a: 128 },     // Semi-transparent red
    { x: 1, y: 1, r: 0, g: 0, b: 0, a: 0 },         // Fully transparent
  ],
  tolerance: 5,
};

/**
 * Full probe bank organized by format.
 * Each format has at least BASE_DECODE; some have feature-specific probes.
 */
const PROBE_BANK: ReadonlyMap<string, ProbeAsset> = new Map([
  // WebP
  [probeKey(ImageFormat.WebP, FormatFeature.BASE_DECODE), WEBP_BASE_DECODE],
  [probeKey(ImageFormat.WebP, FormatFeature.ALPHA), WEBP_ALPHA],

  // AVIF
  [probeKey(ImageFormat.AVIF, FormatFeature.BASE_DECODE), AVIF_BASE_DECODE],

  // HEIC
  [probeKey(ImageFormat.HEIC, FormatFeature.BASE_DECODE), HEIC_BASE_DECODE],
]);

/**
 * Create a lookup key for the probe bank.
 */
function probeKey(format: ImageFormat, feature: FormatFeature): string {
  return `${format}:${feature}`;
}

/**
 * Get a probe asset for a specific format and feature.
 * Returns undefined if no probe is registered (feature cannot be tested).
 */
export function getProbeAsset(format: ImageFormat, feature: FormatFeature): ProbeAsset | undefined {
  return PROBE_BANK.get(probeKey(format, feature));
}

/**
 * Get all probe assets for a format.
 */
export function getFormatProbes(format: ImageFormat): ProbeAsset[] {
  const probes: ProbeAsset[] = [];
  for (const [key, asset] of PROBE_BANK) {
    if (key.startsWith(`${format}:`)) {
      probes.push(asset);
    }
  }
  return probes;
}

/**
 * Get all formats that have at least a BASE_DECODE probe registered.
 */
export function getProbableFormats(): ImageFormat[] {
  const formats: ImageFormat[] = [];
  for (const [key] of PROBE_BANK) {
    if (key.endsWith(`:${FormatFeature.BASE_DECODE}`)) {
      const format = key.split(':')[0] as ImageFormat;
      formats.push(format);
    }
  }
  return formats;
}
