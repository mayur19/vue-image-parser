/**
 * CodecRegistry — Maps image formats to decoders.
 * 
 * Uses CapabilityRegistry to determine which codec (native vs WASM)
 * should be used for each format and support level.
 */

import type { CodecEntry, CodecRegistryInterface } from '../types/codec';
import type { ImageFormat } from '../types/image';
import { ImageFormat as Format } from '../types/image';
import { SupportLevel } from '../types/capability';
import { NativeCodec } from './native-codec';

/**
 * Singleton codec registry.
 */
class CodecRegistryImpl implements CodecRegistryInterface {
  private readonly entries = new Map<ImageFormat, CodecEntry[]>();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Register a codec for its supported formats.
   */
  register(entry: CodecEntry): void {
    for (const format of entry.codec.formats) {
      const existing = this.entries.get(format) ?? [];
      existing.push(entry);
      // Sort by priority (lower = preferred)
      existing.sort((a, b) => a.priority - b.priority);
      this.entries.set(format, existing);
    }
  }

  /**
   * Get the best codec for a format, considering the current support level.
   *
   * For native codecs: only selected if nativeSupport >= requiredSupport
   * For WASM codecs: always eligible (they're the fallback)
   */
  resolve(format: ImageFormat, nativeSupport: SupportLevel): CodecEntry | null {
    const entries = this.entries.get(format);
    if (!entries || entries.length === 0) return null;

    // Find best eligible codec
    for (const entry of entries) {
      if (entry.isNative) {
        // Native codec requires FULL_SUPPORT
        if (nativeSupport === SupportLevel.FULL_SUPPORT) {
          return entry;
        }
        continue;
      }
      // WASM codec is always eligible
      return entry;
    }

    // Fall back to first registered codec
    return entries[0] ?? null;
  }

  /**
   * Get all registered codecs for a format.
   */
  getAll(format: ImageFormat): ReadonlyArray<CodecEntry> {
    return this.entries.get(format) ?? [];
  }

  /**
   * Dispose all codecs.
   */
  disposeAll(): void {
    const disposed = new Set<string>();
    for (const entries of this.entries.values()) {
      for (const entry of entries) {
        if (!disposed.has(entry.codec.name)) {
          entry.codec.dispose?.();
          disposed.add(entry.codec.name);
        }
      }
    }
    this.entries.clear();
  }

  /**
   * Register default native codec for all formats.
   */
  private registerDefaults(): void {
    const nativeCodec = new NativeCodec();

    // Register native codec for all formats (priority 0)
    this.register({
      codec: nativeCodec,
      isNative: true,
      priority: 0,
      requiredSupport: SupportLevel.FULL_SUPPORT,
    });

    // WASM codecs are registered lazily by the engine when needed
  }
}

// ─── Singleton ─────────────────────────────────────────────────

let instance: CodecRegistryImpl | null = null;

/**
 * Get the global codec registry singleton.
 */
export function getCodecRegistry(): CodecRegistryInterface {
  if (!instance) {
    instance = new CodecRegistryImpl();
  }
  return instance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetCodecRegistry(): void {
  instance?.disposeAll();
  instance = null;
}
