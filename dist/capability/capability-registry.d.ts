import { DecodeProbeResult, FormatSupportResult, ProbeOptions, ProbeAllOptions, FormatFeature } from '../types/capability';
import { ImageFormat } from '../types/image';

/**
 * CapabilityDetector interface — implemented by CapabilityRegistry.
 */
export interface CapabilityDetector {
    query(format: ImageFormat, feature?: FormatFeature): FormatSupportResult;
    probe(format: ImageFormat, feature?: FormatFeature, options?: ProbeOptions): Promise<DecodeProbeResult>;
    probeAll(options?: ProbeAllOptions): Promise<ReadonlyMap<ImageFormat, FormatSupportResult>>;
    resolve(format: ImageFormat): Promise<'use_native' | 'use_wasm'>;
    invalidate(format: ImageFormat): void;
    onNativeDecodeFailure(format: ImageFormat, error: Error): void;
    persist(): Promise<void>;
    restore(): Promise<boolean>;
}
/**
 * Get the global CapabilityRegistry singleton.
 */
export declare function getCapabilityRegistry(): CapabilityDetector;
/**
 * Reset the singleton (for testing).
 */
export declare function resetCapabilityRegistry(): void;
//# sourceMappingURL=capability-registry.d.ts.map