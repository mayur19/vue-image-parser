var ImageFormat = /* @__PURE__ */ ((ImageFormat2) => {
  ImageFormat2["JPEG"] = "jpeg";
  ImageFormat2["PNG"] = "png";
  ImageFormat2["WebP"] = "webp";
  ImageFormat2["GIF"] = "gif";
  ImageFormat2["HEIC"] = "heic";
  ImageFormat2["HEIF"] = "heif";
  ImageFormat2["AVIF"] = "avif";
  ImageFormat2["Unknown"] = "unknown";
  return ImageFormat2;
})(ImageFormat || {});
const SIGNATURES = [
  {
    // JPEG: starts with FF D8 FF
    format: ImageFormat.JPEG,
    match: (buf) => buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255
  },
  {
    // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    format: ImageFormat.PNG,
    match: (buf) => buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10
  },
  {
    // GIF: starts with "GIF87a" or "GIF89a"
    format: ImageFormat.GIF,
    match: (buf) => buf.length >= 6 && buf[0] === 71 && buf[1] === 73 && buf[2] === 70 && buf[3] === 56 && (buf[4] === 55 || buf[4] === 57) && buf[5] === 97
  },
  {
    // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
    format: ImageFormat.WebP,
    match: (buf) => buf.length >= 12 && buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf[8] === 87 && buf[9] === 69 && buf[10] === 66 && buf[11] === 80
  }
  // HEIC/HEIF/AVIF are handled by ftyp parser — not matched here.
  // They share the ISOBMFF container and need brand-level parsing.
];
const MIN_DETECTION_BYTES = 64;
const AVIF_BRANDS = /* @__PURE__ */ new Set(["avif", "avis"]);
const HEIC_BRANDS = /* @__PURE__ */ new Set(["heic", "heix", "heim", "heis"]);
const HEIF_BRANDS = /* @__PURE__ */ new Set(["mif1", "msf1"]);
function hasFtypBox(buf) {
  return buf.length >= 12 && buf[4] === 102 && // f
  buf[5] === 116 && // t
  buf[6] === 121 && // y
  buf[7] === 112;
}
function readBrand(buf, offset) {
  if (offset + 4 > buf.length) return "";
  return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
}
function parseFtyp(buf) {
  if (!hasFtypBox(buf)) {
    return ImageFormat.Unknown;
  }
  const boxSize = buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3];
  const readableSize = Math.min(boxSize, buf.length);
  if (readableSize < 12) {
    return ImageFormat.Unknown;
  }
  const brands = /* @__PURE__ */ new Set();
  brands.add(readBrand(buf, 8));
  for (let offset = 16; offset + 4 <= readableSize; offset += 4) {
    const brand = readBrand(buf, offset);
    if (brand.length === 4) {
      brands.add(brand);
    }
  }
  for (const brand of brands) {
    if (AVIF_BRANDS.has(brand)) return ImageFormat.AVIF;
  }
  for (const brand of brands) {
    if (HEIC_BRANDS.has(brand)) return ImageFormat.HEIC;
  }
  for (const brand of brands) {
    if (HEIF_BRANDS.has(brand)) return ImageFormat.HEIF;
  }
  return ImageFormat.Unknown;
}
function couldBeFtyp(buf) {
  return hasFtypBox(buf);
}
function detectFormat(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, MIN_DETECTION_BYTES));
  if (bytes.length < 4) {
    return ImageFormat.Unknown;
  }
  for (const sig of SIGNATURES) {
    if (sig.match(bytes)) {
      return sig.format;
    }
  }
  if (couldBeFtyp(bytes)) {
    const ftypResult = parseFtyp(bytes);
    if (ftypResult !== ImageFormat.Unknown) {
      return ftypResult;
    }
  }
  return ImageFormat.Unknown;
}
function serializeError(error) {
  if (error instanceof Error) {
    return {
      code: error.code ?? "UNKNOWN",
      message: error.message,
      stack: error.stack
    };
  }
  return {
    code: "UNKNOWN",
    message: String(error)
  };
}
function toTransferable(image) {
  const buffer = image.data.buffer;
  return {
    data: {
      data: buffer,
      width: image.width,
      height: image.height,
      format: image.format,
      orientation: image.orientation,
      decodePath: image.decodePath
    },
    transfer: [buffer]
  };
}
const codecs = /* @__PURE__ */ new Map();
const codecLoading = /* @__PURE__ */ new Map();
async function ensureCodec(format) {
  if (codecs.has(format)) return codecs.get(format);
  if (codecLoading.has(format)) {
    await codecLoading.get(format);
    return codecs.get(format) ?? null;
  }
  const loadPromise = loadCodec(format);
  codecLoading.set(format, loadPromise);
  try {
    await loadPromise;
    return codecs.get(format) ?? null;
  } catch {
    return null;
  } finally {
    codecLoading.delete(format);
  }
}
async function loadCodec(format) {
  switch (format) {
    case "heic":
    case "heif": {
      try {
        const { HeicCodec } = await import("./heic-codec-CL1bkcZJ.js");
        const codec = new HeicCodec();
        await codec.init?.();
        codecs.set("heic", codec);
        codecs.set("heif", codec);
      } catch (error) {
        console.error("[worker] Failed to load HEIC codec:", error);
        throw error;
      }
      break;
    }
    case "avif": {
      try {
        const { AvifCodec } = await import("./avif-codec-BNST1hrz.js");
        const codec = new AvifCodec();
        await codec.init?.();
        codecs.set("avif", codec);
      } catch (error) {
        console.error("[worker] Failed to load AVIF codec:", error);
        throw error;
      }
      break;
    }
  }
}
self.addEventListener("message", async (event) => {
  const request = event.data;
  switch (request.type) {
    case "decode":
      await handleDecode(request.id, request.buffer, request.format, request.options);
      break;
    case "init-codec":
      await handleInitCodec(request.id, request.format);
      break;
    case "dispose":
      handleDispose();
      break;
  }
});
async function handleDecode(id, buffer, format, options) {
  try {
    let resolvedFormat = format;
    if (resolvedFormat === "unknown") {
      resolvedFormat = detectFormat(buffer);
    }
    const codec = await ensureCodec(resolvedFormat);
    if (!codec) {
      respond({
        type: "decode-error",
        id,
        error: {
          code: "CODEC_NOT_FOUND",
          message: `No WASM codec available for format: ${resolvedFormat}`
        }
      });
      return;
    }
    const decoded = await codec.decode(buffer, options);
    const { data: transferable, transfer } = toTransferable(decoded);
    self.postMessage(
      { type: "decode-result", id, image: transferable },
      transfer
    );
  } catch (error) {
    respond({
      type: "decode-error",
      id,
      error: serializeError(error)
    });
  }
}
async function handleInitCodec(id, format) {
  try {
    const codec = await ensureCodec(format);
    respond({
      type: "init-result",
      id,
      success: codec !== null
    });
  } catch (error) {
    respond({
      type: "init-result",
      id,
      success: false,
      error: serializeError(error)
    });
  }
}
function handleDispose() {
  for (const codec of codecs.values()) {
    codec.dispose?.();
  }
  codecs.clear();
}
function respond(response) {
  self.postMessage(response);
}
respond({ type: "ready" });
export {
  ImageFormat as I
};
//# sourceMappingURL=decode-worker-Bxk1S_sD.js.map
