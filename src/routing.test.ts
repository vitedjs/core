import { describe, expect, it } from 'vitest';

import type { DocumentPage } from './define-config';
import {
  createLocalizedMenu,
  createLocalizedSite,
  makeLocalizedPath,
  normalizeBaseURL,
  normalizeRoutePath,
  resolveLocales,
} from './routing';

const locales = ['en', 'zh'];

function page(path: string, locale: string): DocumentPage {
  return { path, locale, title: path, file: `${path}.${locale}.md`, frontmatter: {} };
}

describe('localized site', () => {
  const pages = [
    page('/', 'en'),
    page('/', 'zh'),
    page('/guide', 'en'),
    page('/guide/start', 'zh'),
  ];

  it('builds page URLs with the locale prefix, the base URL, and a trailing slash', () => {
    expect(makeLocalizedPath('/', 'en', locales)).toBe('/');
    expect(makeLocalizedPath('/', 'zh', locales)).toBe('/zh/');
    expect(makeLocalizedPath('/guide/start', 'zh', locales)).toBe('/zh/guide/start/');

    const { pages: localizedPages } = createLocalizedSite(pages, locales, '/docs/');
    expect(localizedPages.map(({ pathname, url }) => [pathname, url])).toEqual([
      ['/', '/docs/'],
      ['/zh/', '/docs/zh/'],
      ['/guide/', '/docs/guide/'],
      ['/zh/guide/start/', '/docs/zh/guide/start/'],
    ]);
  });

  it('publishes every route in every locale and falls back to an existing translation', () => {
    const { routes, routeIndex } = createLocalizedSite(pages, locales);
    expect(routes.map((route) => [route.path, route.locale, route.pathname, route.page])).toEqual([
      ['/', 'en', '/', 0],
      ['/guide', 'en', '/guide/', 2],
      ['/guide/start', 'en', '/guide/start/', 3],
      ['/', 'zh', '/zh/', 1],
      ['/guide', 'zh', '/zh/guide/', 2],
      ['/guide/start', 'zh', '/zh/guide/start/', 3],
    ]);
    expect(routeIndex['/zh/guide/start/']).toBe(5);
    expect(routeIndex['/zh/guide/start']).toBe(5);
    expect(routeIndex['/guide']).toBe(1);
  });

  it('derives locales from the pages when none are configured', () => {
    expect(resolveLocales([page('/', 'it')])).toEqual(['it']);
    expect(resolveLocales([page('/', 'it')], locales)).toEqual(locales);
  });

  it('normalizes paths and base URLs', () => {
    expect(normalizeRoutePath('/guide/start/')).toBe('/guide/start');
    expect(normalizeRoutePath('/')).toBe('/');
    expect(normalizeRoutePath('')).toBe('/');
    expect(normalizeBaseURL('/')).toBe('/');
    expect(normalizeBaseURL('')).toBe('/');
    expect(normalizeBaseURL('/docs/')).toBe('/docs');
    expect(normalizeBaseURL('docs/nested/')).toBe('/docs/nested');
  });
});

describe('localized menu', () => {
  it('resolves entry paths for every locale', () => {
    expect(
      createLocalizedMenu(
        [
          { text: 'Guide', path: '/guide' },
          { divider: true },
          { text: 'Home', path: '/', children: [{ text: 'Nested', path: '/nested' }] },
        ],
        locales,
        '/docs/',
      ),
    ).toEqual([
      {
        text: 'Guide',
        path: '/guide',
        pathnames: { en: '/guide/', zh: '/zh/guide/' },
        urls: { en: '/docs/guide/', zh: '/docs/zh/guide/' },
        children: undefined,
      },
      { divider: true, children: undefined },
      {
        text: 'Home',
        path: '/',
        pathnames: { en: '/', zh: '/zh/' },
        urls: { en: '/docs/', zh: '/docs/zh/' },
        children: [
          {
            text: 'Nested',
            path: '/nested',
            pathnames: { en: '/nested/', zh: '/zh/nested/' },
            urls: { en: '/docs/nested/', zh: '/docs/zh/nested/' },
            children: undefined,
          },
        ],
      },
    ]);
  });

  it('keeps entries without a path untouched', () => {
    expect(createLocalizedMenu([{ text: 'GitHub', link: 'https://github.com' }], locales)).toEqual([
      { text: 'GitHub', link: 'https://github.com', children: undefined },
    ]);
    expect(createLocalizedMenu(undefined, locales)).toBeUndefined();
  });
});
