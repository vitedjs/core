import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { DocumentPage } from './defineConfig';

const documentExtensions = new Set(['.md', '.mdx', '.jsx', '.tsx']);

export async function scanDocs(
  root: string,
  supportedLocales: string[] = [],
): Promise<DocumentPage[]> {
  const files = await findDocuments(root);
  const pages = files.map((file) => {
    const relativePath = path.relative(root, file);
    const { route, locale } = getPageRoute(relativePath, supportedLocales);
    return {
      file,
      path: route,
      locale,
      title: titleFromRoute(route),
      frontmatter: {},
    };
  });

  return pages.sort(
    (left, right) => left.path.localeCompare(right.path) || left.locale.localeCompare(right.locale),
  );
}

export function getPageRoute(
  file: string,
  supportedLocales: string[] = [],
): { route: string; locale: string } {
  const normalizedPath = file.replace(/\\/g, '/').replaceAll(path.sep, '/');
  const extension = path.extname(normalizedPath).toLowerCase();
  if (!documentExtensions.has(extension)) {
    throw new Error(`Unsupported documentation file extension: ${file}`);
  }

  const basename = path.posix.basename(normalizedPath, extension);
  const localeMatch = basename.match(/\.([a-z]{2}(?:-[a-z]{2})?)$/i);
  const requestedLocale = localeMatch?.[1];
  const configuredLocale = requestedLocale
    ? supportedLocales.find((item) => item.toLowerCase() === requestedLocale.toLowerCase())
    : undefined;
  const hasSupportedLocale =
    requestedLocale !== undefined &&
    (supportedLocales.length === 0 || configuredLocale !== undefined);
  const stem =
    hasSupportedLocale && requestedLocale
      ? basename.slice(0, -requestedLocale.length - 1)
      : basename;
  const directory = path.posix.dirname(normalizedPath);
  const segments = [...(directory === '.' ? [] : directory.split('/')), stem];
  if (stem.toLowerCase() === 'readme') {
    segments.pop();
  }

  const route =
    `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`.replace(/\/$/, '') ||
    '/';
  return {
    route,
    locale: hasSupportedLocale
      ? (configuredLocale ?? requestedLocale ?? 'en')
      : (supportedLocales[0] ?? 'en'),
  };
}

async function findDocuments(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return findDocuments(file);
      }
      if (entry.isFile() && documentExtensions.has(path.extname(entry.name).toLowerCase())) {
        return [file];
      }
      return [];
    }),
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
}

function titleFromRoute(route: string): string {
  const segment = route.split('/').filter(Boolean).at(-1);
  return segment ? decodeURIComponent(segment).replace(/[-_]/g, ' ') : 'Home';
}
