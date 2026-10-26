// Load the product's fonts from public/fonts before any frame is captured.
import { continueRender, delayRender, staticFile } from 'remotion';

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

let started = false;
export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('fonts');
  Promise.all(
    FACES.map(([family, file, weight, style]) => {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, { weight, style });
      return face.load().then((f) => document.fonts.add(f));
    }),
  ).then(() => continueRender(handle));
};
