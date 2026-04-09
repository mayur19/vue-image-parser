/**
 * Type declarations for external dependencies without their own types.
 */

declare module 'libheif-js' {
  export interface HeifDisplayData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  }

  export interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(displayData: HeifDisplayData, callback: (data: HeifDisplayData | null) => void): void;
  }

  export interface HeifDecoder {
    decode(data: Uint8Array): HeifImage[];
  }

  export interface LibHeif {
    HeifDecoder: new () => HeifDecoder;
  }

  function libheif(): LibHeif;
  export default libheif;
}

declare module 'libheif-js/wasm-bundle' {
  import type { LibHeif } from 'libheif-js';
  export default function(): LibHeif;
}

