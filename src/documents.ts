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
      const metadata = await metadataFromDocument(file, route);
      return {
        file,
        path: route,
        locale,
        title: metadata.title,
        frontmatter: metadata.frontmatter,
        order: metadata.order,
      };
    }),
  );

  return pages
    .toSorted((left, right) => {
      if (left.order !== undefined && right.order !== undefined && left.order !== right.order) {
        return left.order - right.order;
      }
      if (left.order !== undefined) return -1;
      if (right.order !== undefined) return 1;
      return left.path.localeCompare(right.path) || left.locale.localeCompare(right.locale);
    })
    .map(({ order: _order, ...page }) => page);
}

async function metadataFromDocument(
  file: string,
  route: string,
): Promise<{ title: string; order?: number; frontmatter: Record<string, unknown> }> {
  const extension = path.extname(file).toLowerCase();
  if (extension !== '.md' && extension !== '.mdx') {
    return { title: titleFromRoute(route), frontmatter: {} };
  }

  let source: string;
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read documentation page ${file}`, { cause: error });
  }

  const parsed = matter(source);
  const frontmatter = parsed.data as Record<string, unknown>;
  const order =
    typeof frontmatter.order === 'number' && Number.isFinite(frontmatter.order)
      ? frontmatter.order
      : undefined;
  if (typeof frontmatter.title === 'string') {
    return { title: frontmatter.title, order, frontmatter };
  }

  const heading = marked
    .lexer(parsed.content)
    .find((token) => token.type === 'heading' && token.depth === 1);
  if (!heading || heading.type !== 'heading') {
    return { title: titleFromRoute(route), order, frontmatter };
  }

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
  return { title: title || titleFromRoute(route), order, frontmatter };
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
