import { describe, it, expect } from 'vitest';
import { detectFormat, detectFormatFromBlob } from '../../src/detection/detect';
import { SIGNATURES, MIN_DETECTION_BYTES } from '../../src/detection/signatures';
import { ImageFormat } from '../../src/types/image';
import { parseFtyp, couldBeFtyp } from '../../src/detection/ftyp';

/**
 * Create an ArrayBuffer from an array of byte values.
 */
function createBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/**
 * Build a well-formed ISOBMFF ftyp box.
 *
 * @param majorBrand  - 4-char major brand (e.g. 'heic', 'avif', 'mif1')
 * @param compatibleBrands - additional 4-char compatible brands
 * @returns byte array representing the ftyp box
 */
function buildFtypBox(majorBrand: string, compatibleBrands: string[] = []): number[] {
  // box size = 8 (size + type) + 4 (major brand) + 4 (minor version) + 4 * compatible brands
  const boxSize = 16 + compatibleBrands.length * 4;
  const bytes: number[] = [
    // Bytes 0-3: box size (big-endian uint32)
    (boxSize >> 24) & 0xff,
    (boxSize >> 16) & 0xff,
    (boxSize >> 8) & 0xff,
    boxSize & 0xff,
    // Bytes 4-7: 'ftyp'
    0x66, 0x74, 0x79, 0x70,
    // Bytes 8-11: major brand
    ...Array.from(majorBrand).map((c) => c.charCodeAt(0)),
    // Bytes 12-15: minor version (zeros)
    0x00, 0x00, 0x00, 0x00,
  ];

  // Bytes 16+: compatible brands
  for (const brand of compatibleBrands) {
    bytes.push(...Array.from(brand).map((c) => c.charCodeAt(0)));
  }

  return bytes;
}

// ---------------------------------------------------------------------------
// SIGNATURES constant
// ---------------------------------------------------------------------------

describe('SIGNATURES', () => {
  it('exports a non-empty array of signature matchers', () => {
    expect(Array.isArray(SIGNATURES)).toBe(true);
    expect(SIGNATURES.length).toBeGreaterThan(0);
  });

  it('each entry has a format and a match function', () => {
    for (const sig of SIGNATURES) {
      expect(typeof sig.format).toBe('string');
      expect(typeof sig.match).toBe('function');
    }
  });
});

describe('MIN_DETECTION_BYTES', () => {
  it('is at least 12 bytes (minimum for ftyp detection)', () => {
    expect(MIN_DETECTION_BYTES).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// detectFormat — simple magic byte signatures
// ---------------------------------------------------------------------------

describe('detectFormat', () => {
  // ------ JPEG ------

  describe('JPEG detection', () => {
    it('detects JPEG from FF D8 FF signature', () => {
      const buffer = createBuffer([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(detectFormat(buffer)).toBe(ImageFormat.JPEG);
    });

    it('detects JPEG with different APP marker (FF D8 FF E1)', () => {
      const buffer = createBuffer([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00]);
      expect(detectFormat(buffer)).toBe(ImageFormat.JPEG);
    });
  });

  // ------ PNG ------

  describe('PNG detection', () => {
    it('detects PNG from 89 50 4E 47 0D 0A 1A 0A signature', () => {
      const buffer = createBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      expect(detectFormat(buffer)).toBe(ImageFormat.PNG);
    });
  });

  // ------ GIF ------

  describe('GIF detection', () => {
    it('detects GIF87a', () => {
      const buffer = createBuffer([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00]);
      expect(detectFormat(buffer)).toBe(ImageFormat.GIF);
    });

    it('detects GIF89a', () => {
      const buffer = createBuffer([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
      expect(detectFormat(buffer)).toBe(ImageFormat.GIF);
    });

    it('does not detect GIF with invalid version byte', () => {
      // 0x36 = '6', so this would be "GIF86a" — invalid
      const buffer = createBuffer([0x47, 0x49, 0x46, 0x38, 0x36, 0x61, 0x00, 0x00]);
      expect(detectFormat(buffer)).toBe(ImageFormat.Unknown);
    });
  });

  // ------ WebP ------

  describe('WebP detection', () => {
    it('detects WebP from RIFF....WEBP signature', () => {
      const buffer = createBuffer([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size (don't care)
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x00, 0x00,             // padding
      ]);
      expect(detectFormat(buffer)).toBe(ImageFormat.WebP);
    });

    it('does not detect RIFF without WEBP marker', () => {
      const buffer = createBuffer([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00,
        0x41, 0x56, 0x49, 0x20, // "AVI " instead of "WEBP"
        0x00, 0x00,
      ]);
      expect(detectFormat(buffer)).toBe(ImageFormat.Unknown);
    });
  });

  // ------ ISOBMFF / ftyp-based formats ------

  describe('HEIC detection via ftyp', () => {
    it('detects HEIC with major brand "heic"', () => {
      const bytes = buildFtypBox('heic', ['heic']);
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.HEIC);
    });

    it('detects HEIC with major brand "heix"', () => {
      const bytes = buildFtypBox('heix');
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.HEIC);
    });
  });

  describe('AVIF detection via ftyp', () => {
    it('detects AVIF with major brand "avif"', () => {
      const bytes = buildFtypBox('avif', ['avif']);
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.AVIF);
    });

    it('detects AVIF with major brand "avis" (animated AVIF sequence)', () => {
      const bytes = buildFtypBox('avis');
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.AVIF);
    });
  });

  describe('HEIF detection via ftyp', () => {
    it('detects HEIF with major brand "mif1"', () => {
      const bytes = buildFtypBox('mif1');
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.HEIF);
    });

    it('detects HEIF with major brand "msf1"', () => {
      const bytes = buildFtypBox('msf1');
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.HEIF);
    });
  });

  describe('AVIF priority over HEIF', () => {
    it('detects AVIF when major brand is "mif1" but compatible brand includes "avif"', () => {
      // This is a real-world pattern: some AVIF encoders emit mif1 as major brand
      // with avif in compatible brands. AVIF should win due to priority ordering.
      const bytes = buildFtypBox('mif1', ['avif', 'mif1']);
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.AVIF);
    });

    it('detects AVIF when major brand is "mif1" but compatible brand includes "avis"', () => {
      const bytes = buildFtypBox('mif1', ['avis']);
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.AVIF);
    });
  });

  // ------ Edge cases ------

  describe('edge cases', () => {
    it('returns Unknown for random bytes', () => {
      const buffer = createBuffer([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
      expect(detectFormat(buffer)).toBe(ImageFormat.Unknown);
    });

    it('returns Unknown for empty buffer (0 bytes)', () => {
      const buffer = createBuffer([]);
      expect(detectFormat(buffer)).toBe(ImageFormat.Unknown);
    });

    it('returns Unknown for truncated buffer (2 bytes)', () => {
      const buffer = createBuffer([0xff, 0xd8]);
      expect(detectFormat(buffer)).toBe(ImageFormat.Unknown);
    });

    it('returns Unknown for 3 bytes that almost match JPEG (missing third byte)', () => {
      const buffer = createBuffer([0xff, 0xd8, 0x00]);
      expect(detectFormat(buffer)).toBe(ImageFormat.Unknown);
    });

    it('returns Unknown for ftyp box with unrecognised brand', () => {
      const bytes = buildFtypBox('mp41');
      const buffer = createBuffer(bytes);
      expect(detectFormat(buffer)).toBe(ImageFormat.Unknown);
    });
  });
});

// ---------------------------------------------------------------------------
// couldBeFtyp
// ---------------------------------------------------------------------------

describe('couldBeFtyp', () => {
  it('returns true when bytes 4-7 are "ftyp"', () => {
    const bytes = new Uint8Array(buildFtypBox('heic'));
    expect(couldBeFtyp(bytes)).toBe(true);
  });

  it('returns false for random bytes without ftyp marker', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00, 0x68, 0x65, 0x69, 0x63]);
    expect(couldBeFtyp(bytes)).toBe(false);
  });

  it('returns false for a buffer shorter than 12 bytes', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x0c, 0x66, 0x74, 0x79, 0x70]);
    expect(couldBeFtyp(bytes)).toBe(false);
  });

  it('returns false for an empty Uint8Array', () => {
    const bytes = new Uint8Array([]);
    expect(couldBeFtyp(bytes)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseFtyp
// ---------------------------------------------------------------------------

describe('parseFtyp', () => {
  it('returns HEIC for a valid heic ftyp box', () => {
    const bytes = new Uint8Array(buildFtypBox('heic', ['heic']));
    expect(parseFtyp(bytes)).toBe(ImageFormat.HEIC);
  });

  it('returns AVIF for a valid avif ftyp box', () => {
    const bytes = new Uint8Array(buildFtypBox('avif'));
    expect(parseFtyp(bytes)).toBe(ImageFormat.AVIF);
  });

  it('returns HEIF for a valid mif1 ftyp box', () => {
    const bytes = new Uint8Array(buildFtypBox('mif1'));
    expect(parseFtyp(bytes)).toBe(ImageFormat.HEIF);
  });

  it('returns Unknown when buffer has no ftyp signature', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x14, 0xaa, 0xbb, 0xcc, 0xdd, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00]);
    expect(parseFtyp(bytes)).toBe(ImageFormat.Unknown);
  });

  it('returns Unknown when ftyp box size is less than 12', () => {
    // Box size = 8, which is < 12 — should fail the sanity check
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x08, // box size = 8
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x68, 0x65, 0x69, 0x63, // 'heic' (major brand, but box too small)
    ]);
    expect(parseFtyp(bytes)).toBe(ImageFormat.Unknown);
  });

  it('returns Unknown for an ftyp box with an unrecognised brand', () => {
    const bytes = new Uint8Array(buildFtypBox('mp41'));
    expect(parseFtyp(bytes)).toBe(ImageFormat.Unknown);
  });

  it('handles multiple compatible brands and picks AVIF over HEIF', () => {
    // major brand = 'mif1' (HEIF), compatible brands include both 'heic' and 'avif'
    // AVIF should take priority
    const bytes = new Uint8Array(buildFtypBox('mif1', ['heic', 'avif']));
    expect(parseFtyp(bytes)).toBe(ImageFormat.AVIF);
  });

  it('picks HEIC when compatible brands include heic but not avif', () => {
    const bytes = new Uint8Array(buildFtypBox('mif1', ['heic']));
    expect(parseFtyp(bytes)).toBe(ImageFormat.HEIC);
  });

  it('reads compatible brands only within declared box size', () => {
    // Build a ftyp box with declared size = 16 (no room for compatible brands)
    // but physically append extra bytes that look like 'avif'
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x10, // box size = 16
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x6d, 0x69, 0x66, 0x31, // 'mif1' (major brand)
      0x00, 0x00, 0x00, 0x00, // minor version
      // Beyond declared box size — should NOT be read as compatible brand
      0x61, 0x76, 0x69, 0x66, // 'avif' (outside box)
    ]);
    // Should detect as HEIF (mif1), not AVIF, since the avif bytes are beyond box size
    expect(parseFtyp(bytes)).toBe(ImageFormat.HEIF);
  });
});

// ---------------------------------------------------------------------------
// detectFormatFromBlob
// ---------------------------------------------------------------------------

describe('detectFormatFromBlob', () => {
  it('detects JPEG from a Blob', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const blob = new Blob([jpegBytes], { type: 'application/octet-stream' });
    const result = await detectFormatFromBlob(blob);
    expect(result).toBe(ImageFormat.JPEG);
  });

  it('detects PNG from a Blob', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const blob = new Blob([pngBytes], { type: 'application/octet-stream' });
    const result = await detectFormatFromBlob(blob);
    expect(result).toBe(ImageFormat.PNG);
  });

  it('detects AVIF from a Blob with ftyp box', async () => {
    const avifBytes = new Uint8Array(buildFtypBox('avif', ['avif', 'mif1']));
    const blob = new Blob([avifBytes], { type: 'application/octet-stream' });
    const result = await detectFormatFromBlob(blob);
    expect(result).toBe(ImageFormat.AVIF);
  });

  it('returns Unknown from a Blob with random content', async () => {
    const randomBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
    const blob = new Blob([randomBytes], { type: 'application/octet-stream' });
    const result = await detectFormatFromBlob(blob);
    expect(result).toBe(ImageFormat.Unknown);
  });

  it('returns Unknown from an empty Blob', async () => {
    const blob = new Blob([], { type: 'application/octet-stream' });
    const result = await detectFormatFromBlob(blob);
    expect(result).toBe(ImageFormat.Unknown);
  });

  it('only reads the first MIN_DETECTION_BYTES bytes', async () => {
    // Create a large blob where only the first bytes are JPEG signature
    const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const padding = new Uint8Array(10_000);
    const blob = new Blob([header, padding], { type: 'application/octet-stream' });
    const result = await detectFormatFromBlob(blob);
    expect(result).toBe(ImageFormat.JPEG);
  });
});
