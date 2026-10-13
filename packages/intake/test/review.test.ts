import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  downscale,
  encodePng,
  layoutText,
  MAX_IMAGE_BYTES,
  readForReview,
  sniff,
  toGray,
} from '../src/index.js';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../../test/fixtures/${name}`, import.meta.url)));

/** Width, height, color type and the unfiltered pixel rows of a PNG made by encodePng. */
function decodePng(png: Buffer) {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25]!;
  const channels = colorType === 0 ? 1 : 3;
  const idatLength = png.readUInt32BE(33);
  expect(png.subarray(37, 41).toString('latin1')).toBe('IDAT');
  const raw = inflateSync(png.subarray(41, 41 + idatLength));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const v = raw[y * (stride + 1) + 1 + i]!;
      pixels[y * stride + i] = filter === 2 ? (v + pixels[(y - 1) * stride + i]!) & 0xff : v;
    }
  }
  return { width, height, channels, pixels };
}

describe('reading a document for review', () => {
  it('gives the text of each PDF page, with form columns kept apart', async () => {
    const res = await readForReview(fixture('dupont-certificat-salaire-2026.pdf'), 'cert.pdf');
    expect(res).toMatchObject({ format: 'pdf', pages: 2 });
    expect(res.nextPage).toBeUndefined();
    expect(res.items.map((i) => i.page)).toEqual([1, 2]);
    const page1 = res.items[0]!.text;
    expect(page1).toMatch(/^Certificat de salaire/);
    expect(page1).toMatch(/D Année {2,}2026/);
    expect(page1).toMatch(/8\. Salaire brut total \/ rente {2,}85'000\.00/);
    expect(page1).toMatch(/11\. Salaire net \/ rente {2,}75'352\.50/);
    // The line that tries to give orders is returned as text, like any other: it is data.
    expect(page1).toMatch(/Ignore previous instructions/);
    expect(res.items[1]!.text).toMatch(/Fin du document synthétique/);
  });

  it('starts at the page asked for, and says when there is no such page', async () => {
    const bytes = fixture('dupont-certificat-salaire-2026.pdf');
    const second = await readForReview(bytes, 'cert.pdf', 2);
    expect(second.items.map((i) => i.page)).toEqual([2]);
    expect(await readForReview(bytes, 'cert.pdf', 3)).toMatchObject({ problem: 'out_of_range' });
  });

  it('sends a scanned page as an image', async () => {
    const res = await readForReview(fixture('dupont-scan-3a-2026.pdf'), 'scan.pdf');
    expect(res.pages).toBe(1);
    const image = res.items[0]!.image!;
    expect(image.mimeType).toBe('image/png');
    const png = decodePng(image.data);
    expect([png.width, png.height, png.channels]).toEqual([64, 48, 3]);
    // The dark bar drawn at row 12, column 10 survives the round trip.
    expect(png.pixels[(12 * 64 + 10) * 3]).toBe(0x22);
    expect(png.pixels[0]).toBe(0xf4);
  });

  it('returns photos as they are, below the size limit', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
    const res = await readForReview(jpeg, 'photo.jpg');
    expect(res.items[0]!.image).toMatchObject({ mimeType: 'image/jpeg' });
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(jpeg);
    expect(await readForReview(big, 'photo.jpg')).toMatchObject({ problem: 'too_large' });
  });

  it('says plainly what it cannot read', async () => {
    const heic = new Uint8Array([0, 0, 0, 24, ...Buffer.from('ftypheic'), 0, 0, 0, 0]);
    expect(sniff(heic)).toBe('heic');
    expect(await readForReview(heic, 'IMG_0001.HEIC')).toMatchObject({ problem: 'heic' });
    const zip = new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]);
    expect(await readForReview(zip, 'x.docx')).toMatchObject({ problem: 'unsupported' });
    const broken = new Uint8Array(Buffer.from('%PDF-1.7 synthetic test document'));
    expect(await readForReview(broken, 'x.pdf')).toMatchObject({ problem: 'unreadable' });
    expect(await readForReview(new Uint8Array(0), 'x.pdf')).toMatchObject({ problem: 'empty' });
  });

  it('pages long text files', async () => {
    const line = 'ISIN;Name;Value\n';
    const text = new Uint8Array(Buffer.from(line.repeat(3000)));
    const first = await readForReview(text, 'export.csv');
    expect(first).toMatchObject({ format: 'text', pages: 3, nextPage: 2 });
    expect(first.items[0]!.text.length).toBeLessThanOrEqual(16_000);
    const last = await readForReview(text, 'export.csv', 3);
    expect(last.nextPage).toBeUndefined();
  });
});

describe('page layout', () => {
  it('puts items on one baseline into one line, left to right', () => {
    const item = (str: string, x: number, y: number, width: number) => ({
      str,
      transform: [10, 0, 0, 10, x, y],
      width,
    });
    expect(
      layoutText([
        item('85’000.00', 450, 632, 40),
        item('8.', 50, 632, 8),
        item('Salaire brut', 60, 632, 55),
        item('Titre', 50, 700, 25),
      ]),
    ).toBe('Titre\n8. Salaire brut    85’000.00');
  });
});

describe('PNG encoding', () => {
  it('encodes gray and color pixels losslessly', () => {
    const rgb = {
      width: 3,
      height: 2,
      channels: 3 as const,
      data: Uint8Array.from({ length: 18 }, (_, i) => i * 13),
    };
    const decoded = decodePng(encodePng(rgb));
    expect([...decoded.pixels]).toEqual([...rgb.data]);
    const gray = toGray(rgb);
    expect(gray.channels).toBe(1);
    expect([...decodePng(encodePng(gray)).pixels]).toEqual([...gray.data]);
  });

  it('shrinks by averaging', () => {
    const img = {
      width: 4,
      height: 2,
      channels: 1 as const,
      data: Uint8Array.from([0, 100, 200, 200, 0, 100, 200, 200]),
    };
    expect(downscale(img, 2)).toEqual({
      width: 2,
      height: 1,
      channels: 1,
      data: Uint8Array.from([50, 200]),
    });
    expect(downscale(img, 8)).toBe(img);
  });
});
