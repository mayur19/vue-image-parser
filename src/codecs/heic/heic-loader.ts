/**
 * HEIC codec dynamic loader.
 * Provides a factory for lazy-loading the HEIC codec.
 */

import type { Codec } from '../../types/codec';

/**
 * Dynamically import and initialize the HEIC codec.
 * Used by the codec registry for lazy loading.
 */
export async function loadHeicCodec(): Promise<Codec> {
  const { HeicCodec } = await import('./heic-codec');
  const codec = new HeicCodec();
  await codec.init();
  return codec;
}
