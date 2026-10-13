// Bytes to text for exports: UTF-8 (with or without BOM), UTF-16 with a BOM, or Windows-1252 as
// spreadsheet programs sometimes save CSV. Binary files (PDF, images, archives) are not text.

const BINARY_MAGIC = [
  [0x25, 0x50, 0x44, 0x46], // %PDF
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x50, 0x4b, 0x03, 0x04], // ZIP, XLSX, DOCX
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x49, 0x49, 0x2a, 0x00], // TIFF
  [0x4d, 0x4d, 0x00, 0x2a], // TIFF
  [0xd0, 0xcf, 0x11, 0xe0], // old Office (XLS)
];

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b);

function windows1252(bytes: Uint8Array): string {
  try {
    return new TextDecoder('windows-1252').decode(bytes);
  } catch {
    // A Node build without full ICU: Latin-1 is close enough for headers and numbers.
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
  }
}

/** The text of a file, or undefined if it is not text. */
export function decodeText(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0 || BINARY_MAGIC.some((m) => startsWith(bytes, m))) return undefined;
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le').decode(bytes);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be').decode(bytes);
  else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      text = windows1252(bytes);
    }
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // NUL characters mean binary data (or UTF-16 without a BOM, which no broker we read produces).
  if (text.slice(0, 4096).includes('\u0000')) return undefined;
  return text;
}
