// Load the product's fonts from public/fonts before any frame is captured.
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

const FACES: [string, string, string, string][] = [
  ['Chakra Petch', 'chakra-petch-latin-600-normal.woff2', '600', 'normal'],
  ['Chakra Petch', 'chakra-petch-latin-700-normal.woff2', '700', 'normal'],
  ['Chakra Petch', 'chakra-petch-latin-700-italic.woff2', '700', 'italic'],
  ['Inter', 'inter-latin-400-normal.woff2', '400', 'normal'],
  ['Inter', 'inter-latin-500-normal.woff2', '500', 'normal'],
  ['Inter', 'inter-latin-600-normal.woff2', '600', 'normal'],
  ['Inter', 'inter-latin-700-normal.woff2', '700', 'normal'],
  ['JetBrains Mono', 'jetbrains-mono-latin-500-normal.woff2', '500', 'normal'],
  ['JetBrains Mono', 'jetbrains-mono-latin-700-normal.woff2', '700', 'normal'],
];

// One FontFace per file, each attempt bounded by a timeout and retried: a single stalled or failed request in any
// render tab must not hold that tab's delayRender until the global timeout. A real failure cancels the render loudly.
const ATTEMPT_MS = 15000;
const ATTEMPTS = 4;
const withTimeout = <T,>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what}: timed out after ${ms} ms`)), ms))]);

const loadFace = async ([family, file, weight, style]: [string, string, string, string]) => {
  let last: unknown;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, { weight, style });
      document.fonts.add(await withTimeout(face.load(), ATTEMPT_MS, file));
      return;
    } catch (e) {
      last = e;
      console.warn(`font ${file} attempt ${i + 1} failed`, e);
    }
  }
  throw last instanceof Error ? last : new Error(`font ${file} failed to load`);
};

let started = false;
export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('fonts', { timeoutInMilliseconds: ATTEMPTS * ATTEMPT_MS + 30000 });
  Promise.all(FACES.map(loadFace)).then(
    () => continueRender(handle),
    (e) => cancelRender(e),
  );
};
