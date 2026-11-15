import { describe, expect, test } from 'vitest';

import type { DocumentPage } from './define-config';
import { createSitemap, resolveSiteURL } from './sitemap';

function documentPage(pagePath: string, locale = 'en'): DocumentPage {
  return { path: pagePath, locale, title: '', file: '', frontmatter: {} };
}

describe('createSitemap()', () => {
  test('lists every page as an absolute URL with a trailing slash', () => {
    const sitemap = createSitemap(
      [documentPage('/'), documentPage('/guide/start')],
      ['en'],
      'https://example.com',
    );

    expect(sitemap).toContain('<loc>https://example.com/</loc>');
    expect(sitemap).toContain('<loc>https://example.com/guide/start/</loc>');
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
    expect(sitemap.endsWith('</urlset>\n')).toBe(true);
  });

  test('keeps the base path and prefixes non-default locales', () => {
    const sitemap = createSitemap(
      [documentPage('/'), documentPage('/guide/start'), documentPage('/guide/start', 'zh')],
      ['en', 'zh'],
      'https://example.com/docs/',
    );

    expect(sitemap).toContain('<loc>https://example.com/docs/</loc>');
    expect(sitemap).toContain('<loc>https://example.com/docs/guide/start/</loc>');
    expect(sitemap).toContain('<loc>https://example.com/docs/zh/guide/start/</loc>');
  });

  test('encodes non-ASCII document paths', () => {
    const sitemap = createSitemap(
      [documentPage('/%E6%8C%87%E5%8D%97/start')],
      ['en'],
      'https://example.com',
    );

    expect(sitemap).toContain('<loc>https://example.com/%E6%8C%87%E5%8D%97/start/</loc>');
  });

  test('escapes XML entities in URLs', () => {
    const sitemap = createSitemap([documentPage('/start')], ['en'], 'https://example.com/a&b/');

    expect(sitemap).toContain('<loc>https://example.com/a&amp;b/start/</loc>');
  });

  test('sorts URLs', () => {
    const sitemap = createSitemap(
      [documentPage('/b'), documentPage('/a')],
      ['en'],
      'https://example.com',
    );

    expect(sitemap.indexOf('https://example.com/a/')).toBeLessThan(
      sitemap.indexOf('https://example.com/b/'),
    );
  });
});

describe('resolveSiteURL()', () => {
  test('prefers the configured site URL', () => {
    expect(
      resolveSiteURL(
        { siteURL: 'https://example.com/docs' },
        { SITE_URL: 'https://env.example.com' },
      ),
    ).toBe('https://example.com/docs');
  });

  test('falls back to the SITE_URL environment variable', () => {
    expect(resolveSiteURL({}, { SITE_URL: 'https://env.example.com' })).toBe(
      'https://env.example.com/',
    );
  });

  test('returns undefined when no site URL is configured', () => {
    expect(resolveSiteURL({}, {})).toBeUndefined();
  });

  test('rejects relative and non-HTTP URLs', () => {
    expect(resolveSiteURL({ siteURL: './docs' }, {})).toBeUndefined();
    expect(resolveSiteURL({ siteURL: 'ftp://example.com' }, {})).toBeUndefined();
  });
});
