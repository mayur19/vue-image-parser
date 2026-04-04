/**
 * Type declarations for external dependencies without their own types.
 */

declare module 'libheif-js' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(displayData: any, callback: (data: any) => any): any;
  }

  interface HeifDecoder {
    decode(data: Uint8Array): HeifImage[];
  }

  interface LibHeif {
    HeifDecoder: new () => HeifDecoder;
  }

  function libheif(): LibHeif;
  export default libheif;
}

declare module 'libheif-js/wasm-bundle' {
  export default function(): any;
}

declare module '@jsquash/avif/decode' {
  export default function decode(buffer: ArrayBuffer): Promise<ImageData>;
  export function decode(buffer: ArrayBuffer): Promise<ImageData>;
}
