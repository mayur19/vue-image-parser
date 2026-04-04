/**
 * AVIF codec dynamic loader.
 */

import type { Codec } from '../../types/codec';

/**
 * Dynamically import and initialize the AVIF codec.
 */
export async function loadAvifCodec(): Promise<Codec> {
  const { AvifCodec } = await import('./avif-codec');
  const codec = new AvifCodec();
  await codec.init();
  return codec;
}
