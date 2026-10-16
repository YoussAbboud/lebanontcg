import { useEffect } from 'react';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from './site';

export interface PageMeta {
  /** Page title without the site suffix; the suffix is added here. */
  title: string;
  description?: string;
  /** Path for the canonical link and og:url (defaults to the current path). */
  canonicalPath?: string;
  /** Absolute image URL for previews. */
  image?: string;
  type?: 'website' | 'article' | 'product' | 'profile';
  /** Private pages ask crawlers to stay out. */
  noindex?: boolean;
  /** Structured data, rendered as application/ld+json. */
  jsonLd?: Record<string, unknown> | null;
}

/**
 * One head per route. React renders the body; this keeps the document
 * head honest for crawlers that run JavaScript (Google does) and for the
 * tab title. Social scrapers that do not run JavaScript are served by
 * api/share.ts instead — keep the two in step when the copy changes.
 */
export function usePageMeta(meta: PageMeta): void {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    canonicalPath,
    image = DEFAULT_OG_IMAGE,
    type = 'website',
    noindex = false,
    jsonLd = null,
  } = meta;
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — Trading Card Marketplace`;
    const path = canonicalPath ?? window.location.pathname;
    const url = `${SITE_URL}${path}`;

    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:type', type);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setLink('canonical', url);
    setJsonLd(jsonLdText);
  }, [title, description, canonicalPath, image, type, noindex, jsonLdText]);
}

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(text: string): void {
  const id = 'page-jsonld';
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!text) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = text;
}
