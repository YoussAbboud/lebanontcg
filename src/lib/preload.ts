/**
 * Fetch images into the browser cache ahead of showing them, so a page can
 * hold its loading state until its pictures are there instead of revealing
 * empty frames. Resolves when every image has loaded or failed, or when
 * the cap runs out — a slow or broken photo must never hold a page hostage.
 * Resolves at once where there is no DOM (tests, SSR).
 */
export function preloadImages(urls: readonly string[], capMs = 8000): Promise<void> {
  const Img = (globalThis as { Image?: new () => HTMLImageElement }).Image;
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (!Img || unique.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = unique.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, capMs);
    const one = () => {
      left -= 1;
      if (left === 0) finish();
    };
    for (const url of unique) {
      const img = new Img();
      img.onload = one;
      img.onerror = one;
      img.src = url;
    }
  });
}
