import { describe, expect, it } from 'vitest';
import { isHeic, looksLikePickedImage } from './heic';

/** A minimal ftyp box header with the given major brand. */
const ftyp = (brand: string): Uint8Array => {
  const bytes = new Uint8Array(24);
  bytes[3] = 24; // box size
  const put = (s: string, at: number) => {
    for (let i = 0; i < 4; i++) bytes[at + i] = s.charCodeAt(i);
  };
  put('ftyp', 4);
  put(brand, 8);
  return bytes;
};

const JPEG_HEAD = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('isHeic', () => {
  it('detects by declared mime type', async () => {
    expect(await isHeic(new Blob([JPEG_HEAD], { type: 'image/heic' }))).toBe(true);
    expect(await isHeic(new Blob([JPEG_HEAD], { type: 'image/heif' }))).toBe(true);
  });
  it('detects by filename when the picker sets no type', async () => {
    expect(await isHeic(new File([JPEG_HEAD], 'IMG_0421.HEIC', { type: '' }))).toBe(true);
  });
  it('sniffs the ftyp brand for untyped blobs (iPhone heic and spec mif1)', async () => {
    expect(await isHeic(new Blob([ftyp('heic')]))).toBe(true);
    expect(await isHeic(new Blob([ftyp('mif1')]))).toBe(true);
    expect(await isHeic(new Blob([ftyp('heix')]))).toBe(true);
  });
  it('does not flag ordinary images or mp4s', async () => {
    expect(await isHeic(new Blob([JPEG_HEAD], { type: 'image/jpeg' }))).toBe(false);
    expect(await isHeic(new Blob([JPEG_HEAD]))).toBe(false);
    expect(await isHeic(new Blob([ftyp('isom')]))).toBe(false); // mp4, not heif
    expect(await isHeic(new Blob([new Uint8Array(4)]))).toBe(false); // too short
  });
});

describe('looksLikePickedImage', () => {
  it('accepts declared images, untyped picks, and heic by name', () => {
    expect(looksLikePickedImage(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(looksLikePickedImage(new File([], 'IMG.HEIC', { type: '' }))).toBe(true);
    expect(
      looksLikePickedImage(new File([], 'IMG.heif', { type: 'application/octet-stream' })),
    ).toBe(true);
  });
  it('still rejects files that are clearly not images', () => {
    expect(looksLikePickedImage(new File([], 'notes.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});
