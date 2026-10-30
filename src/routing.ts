import type { DocumentPage, MenuEntry } from './define-config';

/** Page metadata that themes use to link to a page. */
export interface LocalizedPage {
  /** Route without locale prefix and without trailing slash, e.g. `/guide/start`. */
  path: string;
  locale: string;
  /** Path matched by the client router, e.g. `/zh/guide/start/`. */
  pathname: string;
  /** Page URL with the base URL, e.g. `/docs/zh/guide/start/`. */
  url: string;
}

export interface LocalizedRoute extends LocalizedPage {
  /** Index of the page that renders this route, falling back to another locale. */
  page: number;
}

export interface LocalizedSite {
  pages: LocalizedPage[];
  routes: LocalizedRoute[];
  /** Lookup from pathname, with and without the trailing slash, to a route index. */
  routeIndex: Record<string, number>;
}

export interface LocalizedMenuEntry extends MenuEntry {
  /** Pathnames of the entry per locale, e.g. `{ en: '/guide/', zh: '/zh/guide/' }`. */
  pathnames?: Record<string, string>;
  /** URLs of the entry per locale, e.g. `{ en: '/docs/guide/', zh: '/docs/zh/guide/' }`. */
  urls?: Record<string, string>;
  children?: LocalizedMenuEntry[];
}

export function createLocalizedSite(
  pages: DocumentPage[],
  supportedLocales: string[] = [],
  baseURL = '/',
): LocalizedSite {
  const locales = resolveLocales(pages, supportedLocales);
  const localizedPages = pages.map((page) => createLocalizedPage(page, locales, baseURL));
  const routes: LocalizedRoute[] = [];
  const routeIndex: Record<string, number> = {};

  for (const locale of locales) {
    for (const path of new Set(pages.map((page) => page.path))) {
      const localizedIndex = localizedPages.findIndex(
        (page) => page.path === path && page.locale === locale,
      );
      const fallbackIndex = localizedPages.findIndex((page) => page.path === path);
      if (fallbackIndex === -1) continue;

      const { pathname, url } = createLocalizedPage({ path, locale }, locales, baseURL);
      routeIndex[pathname] = routes.length;
      routeIndex[normalizeRoutePath(pathname)] = routes.length;
      routes.push({
        path,
        locale,
        pathname,
        url,
        page: localizedIndex === -1 ? fallbackIndex : localizedIndex,
      });
    }
  }

  return { pages: localizedPages, routes, routeIndex };
}

export function createLocalizedMenu(
  menu: MenuEntry[] | undefined,
  supportedLocales: string[] = [],
  baseURL = '/',
): LocalizedMenuEntry[] | undefined {
  if (!menu) return undefined;

  const locales = supportedLocales.length > 0 ? supportedLocales : ['en'];
  return menu.map(({ children, ...entry }) => {
    const localized: LocalizedMenuEntry = { ...entry };
    if (entry.path) {
      localized.pathnames = {};
      localized.urls = {};
      for (const locale of locales) {
        const pathname = makeLocalizedPath(entry.path, locale, locales);
        localized.pathnames[locale] = pathname;
        localized.urls[locale] = toPageURL(baseURL, pathname);
      }
    }
    localized.children = createLocalizedMenu(children, locales, baseURL);
    return localized;
  });
}

export function resolveLocales(pages: DocumentPage[], supportedLocales: string[] = []): string[] {
  return supportedLocales.length > 0
    ? supportedLocales
    : [...new Set(pages.map((page) => page.locale))];
}

/** The returned pathname is relative to the site base URL. */
export function makeLocalizedPath(path: string, locale: string, locales: string[]): string {
  const defaultLocale = locales[0] ?? 'en';
  const localePrefix =
    locale.toLowerCase() === defaultLocale.toLowerCase() ? '' : `/${encodeURIComponent(locale)}`;
  const route = path === '/' ? '' : `/${path.split('/').filter(Boolean).join('/')}`;
  return `${localePrefix}${route}/`;
}

/** Paths are compared without the trailing slash, while page URLs end with one. */
export function normalizeRoutePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

export function normalizeBaseURL(baseURL: string): string {
  const segments = baseURL.split('/').filter(Boolean);
  return segments.length > 0 ? `/${segments.join('/')}` : '/';
}

function createLocalizedPage(
  page: Pick<DocumentPage, 'path' | 'locale'>,
  locales: string[],
  baseURL: string,
): LocalizedPage {
  const pathname = makeLocalizedPath(page.path, page.locale, locales);
  return { path: page.path, locale: page.locale, pathname, url: toPageURL(baseURL, pathname) };
}

function toPageURL(baseURL: string, pathname: string): string {
  return `${baseURL.replace(/\/+$/, '')}${pathname}`;
}
