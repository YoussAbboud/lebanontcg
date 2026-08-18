// iPhones shoot HEIC by default, and browser image decoders won't read
// it — every picked photo goes through toDecodableBlob() before it hits
// createImageBitmap. The converter (bundled libheif, ~1MB) is lazy-
// loaded only when a HEIC actually shows up, so nobody else pays for it.

const HEIC_MIME = /^image\/hei[cf]/i;

/** ftyp major brands used by HEIC/HEIF stills (incl. iPhone's heic and
    the spec's mif1/msf1 structural brands). */
const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);

/** HEIC by declared type, filename, or the ftyp box in the bytes —
    pickers are inconsistent about which of the three they set. */
export async function isHeic(file: Blob): Promise<boolean> {
  if (HEIC_MIME.test(file.type)) return true;
  const name = file instanceof File ? file.name : '';
  if (/\.hei[cf]$/i.test(name)) return true;
  if (file.size < 12) return false;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (o: number) => String.fromCharCode(head[o], head[o + 1], head[o + 2], head[o + 3]);
  return ascii(4) === 'ftyp' && HEIC_BRANDS.has(ascii(8).trim().toLowerCase());
}

/** Picker guard: an image by declared type, or a HEIC / unknown-typed
    file we'll sniff and convert later — some pickers hand HEIC over
    with no type at all, and a readable cropper error beats silently
    ignoring the pick. */
export function looksLikePickedImage(f: File): boolean {
  return f.type.startsWith('image/') || f.type === '' || /\.hei[cf]$/i.test(f.name);
}

/** The blob as something createImageBitmap can decode: HEIC converts
    to JPEG, everything else passes through untouched. */
export async function toDecodableBlob(file: Blob): Promise<Blob> {
  if (!(await isHeic(file))) return file;
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}
