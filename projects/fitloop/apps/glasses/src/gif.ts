import { GifReader } from "omggif";

export interface GifFrames {
  width: number;
  height: number;
  frames: Uint8Array[]; // BMP encoded frames
  delays: number[]; // ms per frame
}

const cache = new Map<string, Promise<GifFrames | null>>();

export function rgbaToBmp(width: number, height: number, rgba: Uint8ClampedArray): Uint8Array {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  // BitmapFileHeader
  view.setUint16(0, 0x424d, false); // "BM"
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true); // offset to pixels

  // BitmapInfoHeader
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true); // top-down
  view.setUint16(26, 1, true); // 1 plane
  view.setUint16(28, 24, true); // 24-bit BGR
  view.setUint32(30, 0, true); // BI_RGB (uncompressed)
  view.setUint32(34, pixelArraySize, true);

  // Fill pixel data (BGR)
  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowOffset + x * 3;
      buf[dstIdx] = rgba[srcIdx + 2];     // B
      buf[dstIdx + 1] = rgba[srcIdx + 1]; // G
      buf[dstIdx + 2] = rgba[srcIdx];     // R
    }
  }
  return buf;
}

export function scaleRgba(srcW: number, srcH: number, srcRgba: Uint8ClampedArray, dstW: number, dstH: number): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.min(srcH - 1, Math.floor(dy * yRatio));
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.min(srcW - 1, Math.floor(dx * xRatio));
      const srcIdx = (sy * srcW + sx) * 4;
      const dstIdx = (dy * dstW + dx) * 4;
      dst[dstIdx] = srcRgba[srcIdx];
      dst[dstIdx + 1] = srcRgba[srcIdx + 1];
      dst[dstIdx + 2] = srcRgba[srcIdx + 2];
      dst[dstIdx + 3] = srcRgba[srcIdx + 3];
    }
  }
  return dst;
}

export async function loadGifFrames(url: string, maxW = 288, maxH = 144): Promise<GifFrames | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const reader = new GifReader(new Uint8Array(buf));
      const numFrames = reader.numFrames();
      if (numFrames === 0) return null;

      const w = reader.width;
      const h = reader.height;
      const scale = Math.min(maxW / w, maxH / h, 1);
      const dstW = Math.max(20, Math.min(maxW, Math.round(w * scale)));
      const dstH = Math.max(20, Math.min(maxH, Math.round(h * scale)));

      const rawRgba = new Uint8ClampedArray(w * h * 4);
      const bmpFrames: Uint8Array[] = [];
      const delays: number[] = [];

      // Sample frames (up to 8 frames so BLE bandwidth is well within bounds)
      const maxSampleFrames = 8;
      const step = Math.max(1, Math.floor(numFrames / maxSampleFrames));

      for (let i = 0; i < numFrames && bmpFrames.length < maxSampleFrames; i += step) {
        reader.decodeAndBlitFrameRGBA(i, rawRgba);
        const scaled = scaleRgba(w, h, rawRgba, dstW, dstH);
        const bmp = rgbaToBmp(dstW, dstH, scaled);
        bmpFrames.push(bmp);
        const info = reader.frameInfo(i);
        delays.push(Math.max(400, (info.delay || 10) * 10 * step));
      }

      return {
        width: dstW,
        height: dstH,
        frames: bmpFrames,
        delays,
      };
    } catch (err) {
      console.error("[fitloop] Failed to decode GIF for glasses:", err);
      return null;
    }
  })();
  cache.set(url, promise);
  return promise;
}
