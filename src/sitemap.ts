import process from 'node:process';

import type { DocsConfig, DocumentPage } from './define-config';
import { getPageURLPath } from './html';

/**
 * Public root URL of the deployed site, including the base path, such as
 * `https://example.com/docs/`. Returns `undefined` when no absolute HTTP URL is configured.
 */
export function resolveSiteURL(
  docs: DocsConfig,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = (docs.siteURL ?? env['SITE_URL'] ?? '').trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Build the `sitemap.xml` document that lists every generated page below the site root. */
export function createSitemap(pages: DocumentPage[], locales: string[], siteURL: string): string {
  const root = siteURL.endsWith('/') ? siteURL : `${siteURL}/`;
  const urls = pages
    .map((page) => escapeXml(new URL(getPageURLPath(page, locales), root).href))
    .toSorted();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`),
    '</urlset>',
    '',
  ].join('\n');
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
