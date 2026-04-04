import { ProbeAsset, DecodeProbeResult } from '../types/capability';

/**
 * Run a pixel-verified decode probe for a single ProbeAsset.
 *
 * @param asset - The probe image with expected pixel values
 * @param options - Optional timeout and performance threshold
 * @returns Detailed probe result including pixel comparisons
 */
export declare function runDecodeTest(asset: ProbeAsset, options?: {
    timeout?: number;
    performanceThresholdMs?: number;
}): Promise<DecodeProbeResult>;
//# sourceMappingURL=decode-test.d.ts.map