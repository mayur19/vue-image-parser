import { ImageFormat } from '../types/image';
import { FormatFeature, ProbeAsset } from '../types/capability';

/**
 * Get a probe asset for a specific format and feature.
 * Returns undefined if no probe is registered (feature cannot be tested).
 */
export declare function getProbeAsset(format: ImageFormat, feature: FormatFeature): ProbeAsset | undefined;
/**
 * Get all probe assets for a format.
 */
export declare function getFormatProbes(format: ImageFormat): ProbeAsset[];
/**
 * Get all formats that have at least a BASE_DECODE probe registered.
 */
export declare function getProbableFormats(): ImageFormat[];
//# sourceMappingURL=format-probe.d.ts.map