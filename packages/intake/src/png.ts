// A small PNG encoder (8-bit gray or RGB) and a box-filter downscaler, so a scanned PDF page can be
// shown to Claude as an image without a native module (SPEC.md section 3: no native modules).
import { deflateSync } from 'node:zlib';

export interface RawImage {
  width: number;
  height: number;
  /** 1 = gray, 3 = RGB. */
  channels: 1 | 3;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Encodes 8-bit gray or RGB pixels as a PNG. Rows use the "Up" filter, which suits scans. */
export function encodePng(img: RawImage): Buffer {
  const { width, height, channels, data } = img;
  if (data.length !== width * height * channels) throw new Error('pixel data has the wrong size');
  const stride = width * channels;
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const out = y * (stride + 1);
    filtered[out] = y === 0 ? 0 : 2; // None for the first row, Up after
    for (let i = 0; i < stride; i++) {
      const v = data[y * stride + i]!;
      filtered[out + 1 + i] = y === 0 ? v : (v - data[(y - 1) * stride + i]!) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 1 ? 0 : 2; // gray or truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filtered, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Shrinks an image so its longer side is at most `maxEdge`, averaging the pixels it merges. */
export function downscale(img: RawImage, maxEdge: number): RawImage {
  const { width, height, channels, data } = img;
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return img;
  const w = Math.max(1, Math.round((width * maxEdge) / longest));
  const h = Math.max(1, Math.round((height * maxEdge) / longest));
  const out = new Uint8Array(w * h * channels);
  for (let ty = 0; ty < h; ty++) {
    const y0 = Math.floor((ty * height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / h));
    for (let tx = 0; tx < w; tx++) {
      const x0 = Math.floor((tx * width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / w));
      for (let c = 0; c < channels; c++) {
        let sum = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) sum += data[(y * width + x) * channels + c]!;
        }
        out[(ty * w + tx) * channels + c] = Math.round(sum / ((y1 - y0) * (x1 - x0)));
      }
    }
  }
  return { width: w, height: h, channels, data: out };
}

/** RGB to gray (ITU-R BT.601 weights, in integers). */
export function toGray(img: RawImage): RawImage {
  if (img.channels === 1) return img;
  const n = img.width * img.height;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 3]!;
    const g = img.data[i * 3 + 1]!;
    const b = img.data[i * 3 + 2]!;
    out[i] = Math.floor((r * 299 + g * 587 + b * 114 + 500) / 1000);
  }
  return { ...img, channels: 1, data: out };
}
