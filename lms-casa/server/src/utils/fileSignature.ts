import fs from 'node:fs';

/** Magic-byte signatures for file types accepted by upload endpoints. */
const SIGNATURES = {
  png: (b: Buffer) =>
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  jpeg: (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b: Buffer) =>
    b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  pdf: (b: Buffer) => b.length >= 4 && b.toString('ascii', 0, 4) === '%PDF',
  // ZIP local-file-header / empty-archive / spanned-archive signatures (XLSX is a ZIP container).
  zip: (b: Buffer) =>
    b.length >= 4 &&
    b[0] === 0x50 && b[1] === 0x4b &&
    (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) &&
    (b[3] === 0x04 || b[3] === 0x06 || b[3] === 0x08),
} as const;

export type FileKind = keyof typeof SIGNATURES;

/** Read the first `len` bytes of a file on disk (for multer diskStorage uploads). */
export function readHeader(filePath: string, len = 16): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(len);
    const bytesRead = fs.readSync(fd, buf, 0, len, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

/** True if the buffer's magic bytes match any of the given file kinds. */
export function matchesSignature(buffer: Buffer, kinds: FileKind[]): boolean {
  return kinds.some((kind) => SIGNATURES[kind](buffer));
}
