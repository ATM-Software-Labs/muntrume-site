/**
 * Pure browser TGA (Truevision Targa) encoder & decoder for iRacing paints.
 * - Encoder outputs uncompressed 24-bit BGR (type 2, bottom-up) — 100% compatible with iRacing & Trading Paints.
 * - Decoder supports 24/32-bit uncompressed (type 2) and RLE (type 10) templates exported from Photoshop/GIMP/iRacing.
 */

export function encodeTgaFromImageData(imageData: ImageData, includeAlpha = false): Uint8Array {
  const { width, height, data } = imageData;
  const bytesPerPixel = includeAlpha ? 4 : 3;
  const headerSize = 18;
  const footerSize = 26;
  const pixelBytes = width * height * bytesPerPixel;
  const out = new Uint8Array(headerSize + pixelBytes + footerSize);

  // TGA Header (18 bytes)
  out[0] = 0; // ID length
  out[1] = 0; // Color map type: none
  out[2] = 2; // Image type: uncompressed true-color
  // Color map spec (bytes 3..7) = 0
  // X-origin, Y-origin (bytes 8..11) = 0
  out[12] = width & 0xff;
  out[13] = (width >> 8) & 0xff;
  out[14] = height & 0xff;
  out[15] = (height >> 8) & 0xff;
  out[16] = includeAlpha ? 32 : 24; // Bits per pixel (24-bit standard iRacing / Trading Paints)
  // Image descriptor: bit 5 = 0 (bottom-left origin, standard Photoshop/iRacing TGA), alpha bits = 8 or 0
  out[17] = includeAlpha ? 8 : 0;

  let dst = headerSize;
  for (let y = height - 1; y >= 0; y--) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const src = rowOffset + x * 4;
      out[dst++] = data[src + 2]; // B
      out[dst++] = data[src + 1]; // G
      out[dst++] = data[src]; // R
      if (includeAlpha) {
        out[dst++] = data[src + 3]; // A
      }
    }
  }

  // Standard TGA 2.0 Footer (26 bytes: 8 zero bytes + "TRUEVISION-XFILE." + NUL)
  // Required by Photoshop / ImageMagick / Trading Paints server-side TGA validator
  const sig = "TRUEVISION-XFILE.";
  const sigStart = headerSize + pixelBytes + 8;
  for (let i = 0; i < sig.length; i++) {
    out[sigStart + i] = sig.charCodeAt(i);
  }
  out[sigStart + sig.length] = 0;

  return out;
}

export function decodeTgaToImageData(buffer: ArrayBuffer): ImageData {
  if (buffer.byteLength < 18) {
    throw new Error("Archivo TGA inválido o demasiado pequeño.");
  }
  const bytes = new Uint8Array(buffer);
  const idLength = bytes[0];
  const colorMapType = bytes[1];
  const imageType = bytes[2];
  const colorMapLength = bytes[5] | (bytes[6] << 8);
  const colorMapEntrySize = bytes[7];
  const width = bytes[12] | (bytes[13] << 8);
  const height = bytes[14] | (bytes[15] << 8);
  const bpp = bytes[16];
  const descriptor = bytes[17];

  if (width <= 0 || height <= 0 || width > 8192 || height > 8192) {
    throw new Error(`Dimensiones TGA no soportadas (${width}×${height}).`);
  }
  if (imageType !== 2 && imageType !== 10) {
    throw new Error(`Tipo TGA ${imageType} no soportado. Usa TGA RGB/RGBA 24 o 32 bits (sin compresión o RLE).`);
  }
  if (bpp !== 24 && bpp !== 32) {
    throw new Error(`Profundidad TGA de ${bpp} bits no soportada (requiere 24 o 32 bits).`);
  }

  const pixelDepth = bpp / 8;
  const colorMapBytes = colorMapType === 1 ? colorMapLength * Math.ceil(colorMapEntrySize / 8) : 0;
  let offset = 18 + idLength + colorMapBytes;

  const totalPixels = width * height;
  const rawPixels = new Uint8ClampedArray(totalPixels * 4);

  if (imageType === 2) {
    for (let i = 0; i < totalPixels; i++) {
      if (offset + pixelDepth > bytes.length) break;
      const b = bytes[offset++];
      const g = bytes[offset++];
      const r = bytes[offset++];
      const a = pixelDepth === 4 ? bytes[offset++] : 255;
      const p = i * 4;
      rawPixels[p] = r;
      rawPixels[p + 1] = g;
      rawPixels[p + 2] = b;
      rawPixels[p + 3] = a;
    }
  } else {
    // RLE compressed (type 10)
    let pixelIdx = 0;
    while (pixelIdx < totalPixels && offset < bytes.length) {
      const header = bytes[offset++];
      const count = (header & 0x7f) + 1;
      if ((header & 0x80) !== 0) {
        if (offset + pixelDepth > bytes.length) break;
        const b = bytes[offset++];
        const g = bytes[offset++];
        const r = bytes[offset++];
        const a = pixelDepth === 4 ? bytes[offset++] : 255;
        for (let k = 0; k < count && pixelIdx < totalPixels; k++) {
          const p = pixelIdx++ * 4;
          rawPixels[p] = r;
          rawPixels[p + 1] = g;
          rawPixels[p + 2] = b;
          rawPixels[p + 3] = a;
        }
      } else {
        for (let k = 0; k < count && pixelIdx < totalPixels; k++) {
          if (offset + pixelDepth > bytes.length) break;
          const b = bytes[offset++];
          const g = bytes[offset++];
          const r = bytes[offset++];
          const a = pixelDepth === 4 ? bytes[offset++] : 255;
          const p = pixelIdx++ * 4;
          rawPixels[p] = r;
          rawPixels[p + 1] = g;
          rawPixels[p + 2] = b;
          rawPixels[p + 3] = a;
        }
      }
    }
  }

  const topToBottom = (descriptor & 0x20) !== 0;
  const rightToLeft = (descriptor & 0x10) !== 0;

  if (topToBottom && !rightToLeft) {
    return new ImageData(rawPixels, width, height);
  }

  const oriented = new Uint8ClampedArray(totalPixels * 4);
  for (let y = 0; y < height; y++) {
    const srcY = topToBottom ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const srcX = rightToLeft ? width - 1 - x : x;
      const s = (srcY * width + srcX) * 4;
      const d = (y * width + x) * 4;
      oriented[d] = rawPixels[s];
      oriented[d + 1] = rawPixels[s + 1];
      oriented[d + 2] = rawPixels[s + 2];
      oriented[d + 3] = rawPixels[s + 3];
    }
  }
  return new ImageData(oriented, width, height);
}
