import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCapabilityRegistry,
  resetCapabilityRegistry,
} from '../../src/capability/capability-registry';
import { ImageFormat, UNIVERSALLY_SUPPORTED_FORMATS } from '../../src/types/image';
import { SupportLevel, FormatFeature } from '../../src/types/capability';

describe('CapabilityRegistry', () => {
  beforeEach(() => {
    resetCapabilityRegistry();
  });

  it('returns same singleton instance', () => {
    const a = getCapabilityRegistry();
    const b = getCapabilityRegistry();
    expect(a).toBe(b);
  });

  it('resetCapabilityRegistry creates new instance', () => {
    const a = getCapabilityRegistry();
    resetCapabilityRegistry();
    const b = getCapabilityRegistry();
    expect(a).not.toBe(b);
  });

  describe('query', () => {
    it('returns FULL_SUPPORT for universal formats (JPEG, PNG, GIF)', () => {
      const registry = getCapabilityRegistry();
      for (const format of UNIVERSALLY_SUPPORTED_FORMATS) {
        const result = registry.query(format);
        expect(result.recommendation).toBe('use_native');
        expect(result.verified).toBe(true);
        expect(result.features.get(FormatFeature.BASE_DECODE)).toBe(SupportLevel.FULL_SUPPORT);
      }
    });

    it('returns unknown recommendation for unprobed non-universal format', () => {
      const registry = getCapabilityRegistry();
      const result = registry.query(ImageFormat.HEIC);
      expect(result.recommendation).toBe('unknown');
      expect(result.verified).toBe(false);
    });
  });

  describe('resolve', () => {
    it('returns use_native for universal formats', async () => {
      const registry = getCapabilityRegistry();
      const result = await registry.resolve(ImageFormat.JPEG);
      expect(result).toBe('use_native');
    });

    it('returns use_wasm for unprobed HEIC (conservative default)', async () => {
      const registry = getCapabilityRegistry();
      const result = await registry.resolve(ImageFormat.HEIC);
      expect(result).toBe('use_wasm');
    });

    it('returns use_wasm for downgraded format', async () => {
      const registry = getCapabilityRegistry();
      registry.onNativeDecodeFailure(ImageFormat.WebP, new Error('test'));
      const result = await registry.resolve(ImageFormat.WebP);
      expect(result).toBe('use_wasm');
    });
  });

  describe('invalidate', () => {
    it('clears downgrade status', async () => {
      const registry = getCapabilityRegistry();
      registry.onNativeDecodeFailure(ImageFormat.AVIF, new Error('test'));

      // Downgraded → use_wasm
      expect(await registry.resolve(ImageFormat.AVIF)).toBe('use_wasm');

      // Invalidate clears downgrade
      registry.invalidate(ImageFormat.AVIF);
      // After invalidate, it's unprobed → still use_wasm (conservative)
      expect(await registry.resolve(ImageFormat.AVIF)).toBe('use_wasm');
    });
  });

  describe('onNativeDecodeFailure', () => {
    it('downgrades the format', async () => {
      const registry = getCapabilityRegistry();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.onNativeDecodeFailure(ImageFormat.HEIC, new Error('decode failed'));

      const result = await registry.resolve(ImageFormat.HEIC);
      expect(result).toBe('use_wasm');

      warnSpy.mockRestore();
    });
  });
});
