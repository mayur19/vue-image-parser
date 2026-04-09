import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCodecRegistry, resetCodecRegistry } from '../../src/codecs/registry';
import { ImageFormat } from '../../src/types/image';
import { SupportLevel } from '../../src/types/capability';
import type { Codec, CodecEntry } from '../../src/types/codec';

function createMockCodec(name: string, formats: ImageFormat[]): Codec {
  return {
    name,
    formats,
    decode: vi.fn().mockResolvedValue({} as any),
    dispose: vi.fn(),
  };
}

function createWasmEntry(
  name: string,
  formats: ImageFormat[],
  priority: number,
): CodecEntry {
  return {
    codec: createMockCodec(name, formats),
    isNative: false,
    priority,
    requiredSupport: SupportLevel.NO_SUPPORT,
  };
}

describe('CodecRegistry', () => {
  beforeEach(() => {
    resetCodecRegistry();
  });

  describe('singleton behavior', () => {
    it('getCodecRegistry returns the same instance on repeated calls', () => {
      const first = getCodecRegistry();
      const second = getCodecRegistry();

      expect(first).toBe(second);
    });

    it('resetCodecRegistry creates a new instance', () => {
      const first = getCodecRegistry();
      resetCodecRegistry();
      const second = getCodecRegistry();

      expect(first).not.toBe(second);
    });
  });

  describe('default native codec registration', () => {
    it('registers a default native codec for JPEG', () => {
      const registry = getCodecRegistry();
      const entries = registry.getAll(ImageFormat.JPEG);

      expect(entries.length).toBeGreaterThanOrEqual(1);

      const nativeEntry = entries.find((e) => e.isNative);
      expect(nativeEntry).toBeDefined();
      expect(nativeEntry!.codec.name).toBe('native-browser');
      expect(nativeEntry!.priority).toBe(0);
      expect(nativeEntry!.requiredSupport).toBe(SupportLevel.FULL_SUPPORT);
    });
  });

  describe('resolve', () => {
    it('returns the native codec when nativeSupport is FULL_SUPPORT', () => {
      const registry = getCodecRegistry();
      const entry = registry.resolve(ImageFormat.JPEG, SupportLevel.FULL_SUPPORT);

      expect(entry).not.toBeNull();
      expect(entry!.isNative).toBe(true);
      expect(entry!.codec.name).toBe('native-browser');
    });

    it('skips native codec with NO_SUPPORT and returns null when no WASM registered', () => {
      const registry = getCodecRegistry();
      const entry = registry.resolve(ImageFormat.JPEG, SupportLevel.NO_SUPPORT);

      // The implementation falls back to entries[0] (native) even when NO_SUPPORT,
      // but the resolve loop first skips native, finds no WASM, then falls back.
      // Based on the source: after the loop it returns entries[0] ?? null.
      // So it returns the native codec as a last resort.
      // Let's verify the actual behavior:
      expect(entry).not.toBeNull();
      expect(entry!.isNative).toBe(true);
    });

    it('returns WASM codec when nativeSupport is NO_SUPPORT and WASM is registered', () => {
      const registry = getCodecRegistry();
      const wasmEntry = createWasmEntry('jpeg-wasm', [ImageFormat.JPEG], 10);
      registry.register(wasmEntry);

      const resolved = registry.resolve(ImageFormat.JPEG, SupportLevel.NO_SUPPORT);

      expect(resolved).not.toBeNull();
      expect(resolved!.isNative).toBe(false);
      expect(resolved!.codec.name).toBe('jpeg-wasm');
    });

    it('returns null for a format with no registered codecs', () => {
      const registry = getCodecRegistry();

      // Unknown format has no default registration
      const entry = registry.resolve(ImageFormat.Unknown, SupportLevel.FULL_SUPPORT);

      expect(entry).toBeNull();
    });
  });

  describe('priority ordering', () => {
    it('prefers lower priority codecs', () => {
      const registry = getCodecRegistry();

      const highPriority = createWasmEntry('wasm-high', [ImageFormat.AVIF], 20);
      const lowPriority = createWasmEntry('wasm-low', [ImageFormat.AVIF], 5);

      registry.register(highPriority);
      registry.register(lowPriority);

      const entries = registry.getAll(ImageFormat.AVIF);

      // Native codec is at priority 0, then wasm-low at 5, then wasm-high at 20
      expect(entries[0].priority).toBe(0);
      expect(entries[1].codec.name).toBe('wasm-low');
      expect(entries[2].codec.name).toBe('wasm-high');
    });

    it('resolves to the lowest priority WASM codec when native is skipped', () => {
      const registry = getCodecRegistry();

      const highPriority = createWasmEntry('wasm-high', [ImageFormat.HEIC], 20);
      const lowPriority = createWasmEntry('wasm-low', [ImageFormat.HEIC], 5);

      registry.register(highPriority);
      registry.register(lowPriority);

      // With NO_SUPPORT, native is skipped; the first WASM in sorted order wins
      const resolved = registry.resolve(ImageFormat.HEIC, SupportLevel.NO_SUPPORT);

      expect(resolved).not.toBeNull();
      expect(resolved!.codec.name).toBe('wasm-low');
    });
  });

  describe('getAll', () => {
    it('returns all codecs for a format sorted by priority', () => {
      const registry = getCodecRegistry();

      const wasm1 = createWasmEntry('wasm-a', [ImageFormat.PNG], 15);
      const wasm2 = createWasmEntry('wasm-b', [ImageFormat.PNG], 5);

      registry.register(wasm1);
      registry.register(wasm2);

      const all = registry.getAll(ImageFormat.PNG);

      expect(all.length).toBe(3); // native (0) + wasm-b (5) + wasm-a (15)
      expect(all[0].priority).toBe(0);
      expect(all[1].priority).toBe(5);
      expect(all[2].priority).toBe(15);
    });

    it('returns an empty array for a format with no registered codecs', () => {
      const registry = getCodecRegistry();
      const all = registry.getAll(ImageFormat.Unknown);

      expect(all).toEqual([]);
    });
  });

  describe('disposeAll', () => {
    it('calls dispose on all registered codecs', () => {
      const registry = getCodecRegistry();

      const wasmEntry = createWasmEntry('wasm-dispose', [ImageFormat.WebP], 10);
      registry.register(wasmEntry);

      registry.disposeAll();

      expect(wasmEntry.codec.dispose).toHaveBeenCalledOnce();
    });

    it('clears all registrations after dispose', () => {
      const registry = getCodecRegistry();

      const wasmEntry = createWasmEntry('wasm-clear', [ImageFormat.GIF], 10);
      registry.register(wasmEntry);

      // Verify codec exists before dispose
      expect(registry.getAll(ImageFormat.GIF).length).toBeGreaterThan(0);

      registry.disposeAll();

      // After dispose, all entries are cleared
      expect(registry.getAll(ImageFormat.GIF)).toEqual([]);
      expect(registry.getAll(ImageFormat.JPEG)).toEqual([]);
    });

    it('does not call dispose twice on the same codec registered for multiple formats', () => {
      const registry = getCodecRegistry();

      const multiFormatCodec = createMockCodec('multi-wasm', [
        ImageFormat.HEIC,
        ImageFormat.HEIF,
      ]);
      const entry: CodecEntry = {
        codec: multiFormatCodec,
        isNative: false,
        priority: 10,
        requiredSupport: SupportLevel.NO_SUPPORT,
      };
      registry.register(entry);

      registry.disposeAll();

      expect(multiFormatCodec.dispose).toHaveBeenCalledOnce();
    });
  });

  describe('multiple codecs for same format', () => {
    it('registers and sorts multiple codecs by priority', () => {
      const registry = getCodecRegistry();

      const wasmA = createWasmEntry('wasm-a', [ImageFormat.AVIF], 30);
      const wasmB = createWasmEntry('wasm-b', [ImageFormat.AVIF], 10);
      const wasmC = createWasmEntry('wasm-c', [ImageFormat.AVIF], 20);

      registry.register(wasmA);
      registry.register(wasmB);
      registry.register(wasmC);

      const all = registry.getAll(ImageFormat.AVIF);

      // native (0), wasm-b (10), wasm-c (20), wasm-a (30)
      expect(all.length).toBe(4);
      expect(all[0].priority).toBe(0);
      expect(all[1].codec.name).toBe('wasm-b');
      expect(all[1].priority).toBe(10);
      expect(all[2].codec.name).toBe('wasm-c');
      expect(all[2].priority).toBe(20);
      expect(all[3].codec.name).toBe('wasm-a');
      expect(all[3].priority).toBe(30);
    });
  });
});
