// Flag images from flag-icons (lipis/flag-icons, MIT), bundled with the
// site: each SVG is its own small file, fetched only when a flag is shown.
// vite.config.ts keeps them out of the JS (no inlining).
const files = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});

const urlByIso = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const iso = path.slice(path.lastIndexOf('/') + 1, -'.svg'.length).toUpperCase();
  urlByIso.set(iso, url);
}

export const flagUrl = (iso: string): string | undefined => urlByIso.get(iso.toUpperCase());
