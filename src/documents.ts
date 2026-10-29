import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

import type { DocumentPage } from './define-config';

const documentExtensions = new Set(['.md', '.mdx', '.jsx', '.tsx']);

export async function scanDocs(
  root: string,
  supportedLocales: string[] = [],
): Promise<DocumentPage[]> {
  const files = await findDocuments(root);
  const pages = await Promise.all(
    files.map(async (file) => {
      const relativePath = path.relative(root, file);
      const { route, locale } = getPageRoute(relativePath, supportedLocales);
      return {
        file,
        path: route,
        locale,
        title: await titleFromDocument(file, route),
        frontmatter: {},
      };
    }),
  );

  return pages.toSorted(
    (left, right) => left.path.localeCompare(right.path) || left.locale.localeCompare(right.locale),
  );
}

async function titleFromDocument(file: string, route: string): Promise<string> {
  const extension = path.extname(file).toLowerCase();
  if (extension !== '.md' && extension !== '.mdx') return titleFromRoute(route);

  let source: string;
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read documentation page ${file}`, { cause: error });
  }

  const parsed = matter(source);
  if (typeof parsed.data.title === 'string') return parsed.data.title;

  const heading = marked
    .lexer(parsed.content)
    .find((token) => token.type === 'heading' && token.depth === 1);
  if (!heading || heading.type !== 'heading') return titleFromRoute(route);

  const headingHtml = marked.parseInline(heading.text, { async: false });
  if (typeof headingHtml !== 'string') {
    throw new TypeError(`Failed to parse documentation page title: ${file}`);
  }
  const title = sanitizeHtml(headingHtml, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replaceAll(/\s+/g, ' ')
    .trim();
  return title || titleFromRoute(route);
}

export function getPageRoute(
  file: string,
  supportedLocales: string[] = [],
): { route: string; locale: string } {
  const normalizedPath = file.replaceAll('\\', '/');
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
  return nested.flat().toSorted((left, right) => left.localeCompare(right));
}

function titleFromRoute(route: string): string {
  const segment = route.split('/').findLast(Boolean);
  return segment ? decodeURIComponent(segment).replaceAll(/[-_]/g, ' ') : 'Home';
}
