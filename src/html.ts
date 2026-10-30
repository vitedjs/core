import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { DocsConfig, DocumentPage } from './define-config';

type OutputBundle = Record<
  string,
  | { type: 'asset'; fileName: string; source: string | Uint8Array }
  | {
      type: 'chunk';
      fileName: string;
      isEntry: boolean;
      facadeModuleId?: string | null;
    }
>;

export interface Favicon {
  type: 'image/svg+xml' | 'image/png';
  href: string;
}

export async function readProjectFavicon(docsRoot: string): Promise<Favicon | undefined> {
  for (const [fileName, type] of [
    ['favicon.svg', 'image/svg+xml'],
    ['favicon.png', 'image/png'],
  ] as const) {
    const file = path.join(docsRoot, fileName);
    try {
      const contents = await readFile(file);
      return {
        type,
        href:
          type === 'image/svg+xml'
            ? `data:${type},${encodeURIComponent(contents.toString('utf8'))}`
            : `data:${type};base64,${contents.toString('base64')}`,
      };
    } catch (error) {
      if (isMissingFileError(error)) continue;
      throw new Error(`Failed to read documentation favicon at ${file}`, { cause: error });
    }
  }
  return;
}

export function createDefaultHtml(favicon?: Favicon): string {
  const faviconLink = favicon
    ? `    <link rel="icon" type="${favicon.type}" href="${favicon.href}" />\n`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${faviconLink}    <title>Vited</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
}

export function createDefaultDocumentHtml(
  favicon: Favicon | undefined,
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
): string {
  const shell = createDefaultHtml(favicon);
  const titledShell = applyDefaultTitle(shell, docs, packageJSON);
  return applyHtmlMetadata(titledShell, docs, packageJSON);
}

export function replaceFaviconLink(
  html: string,
  favicon: Favicon | undefined,
): { html: string; injectFavicon: boolean } {
  if (!favicon) return { html, injectFavicon: false };
  let hasFavicon = false;
  const updatedHtml = html.replaceAll(/<link\b[^>]*>/gi, (linkTag) => {
    if (!isFaviconLink(linkTag)) return linkTag;
    if (hasFavicon) return '';
    hasFavicon = true;
    return `<link rel="icon" type="${favicon.type}" href="${escapeHtmlAttribute(favicon.href)}" />`;
  });
  return { html: updatedHtml, injectFavicon: !hasFavicon };
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function applyHtmlMetadata(
  html: string,
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
): string {
  const packageDescription =
    typeof packageJSON['description'] === 'string' ? packageJSON['description'] : undefined;
  const packageKeywords = packageJSON['keywords'];
  const keywordsFromPackage =
    Array.isArray(packageKeywords) &&
    packageKeywords.every((keyword) => typeof keyword === 'string')
      ? packageKeywords.join(', ')
      : undefined;
  const description = docs.description ?? packageDescription;
  const keywords = docs.keywords?.join(', ') ?? keywordsFromPackage;

  let updatedHtml = html;
  if (description !== undefined) {
    updatedHtml = upsertMetaTag(updatedHtml, 'description', description);
  }
  if (keywords !== undefined) {
    updatedHtml = upsertMetaTag(updatedHtml, 'keywords', keywords);
  }
  return updatedHtml;
}

export async function emitStaticHtmlPages({
  bundle,
  clientEntry,
  baseURL,
  useDefaultHtml,
  pages,
  docs,
  packageJSON,
  favicon,
  emitFile,
}: {
  bundle: OutputBundle;
  clientEntry: string;
  baseURL: string;
  useDefaultHtml: boolean;
  pages: DocumentPage[];
  docs: DocsConfig;
  packageJSON: Record<string, unknown>;
  favicon: Favicon | undefined;
  emitFile: (fileName: string, source: string) => void;
}): Promise<void> {
  if (!useDefaultHtml && pages.length === 0) return;

  let htmlShell: string;
  if (useDefaultHtml) {
    const clientChunk = Object.values(bundle).find(
      (output) =>
        output.type === 'chunk' && output.isEntry && output.facadeModuleId === clientEntry,
    );
    if (!clientChunk || clientChunk.type !== 'chunk') {
      throw new Error('Vited could not find the built client entry for its HTML shell.');
    }

    const html = createDefaultDocumentHtml(favicon, docs, packageJSON);
    const scriptSrc = escapeHtmlAttribute(`${baseURL}${clientChunk.fileName}`);
    const stylesheetLinks = Object.values(bundle)
      .filter((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
      .map(
        (output) =>
          `    <link rel="stylesheet" href="${escapeHtmlAttribute(`${baseURL}${output.fileName}`)}" />`,
      )
      .join('\n');
    const htmlWithStyles = stylesheetLinks
      ? html.replace('</head>', `${stylesheetLinks}\n  </head>`)
      : html;
    htmlShell = htmlWithStyles.replace(
      '</body>',
      `    <script type="module" src="${scriptSrc}"></script>\n  </body>`,
    );
  } else {
    const indexAsset = bundle['index.html'];
    if (!indexAsset || indexAsset.type !== 'asset') {
      throw new Error('Vited could not find index.html to generate static documentation pages.');
    }
    htmlShell =
      typeof indexAsset.source === 'string'
        ? indexAsset.source
        : Buffer.from(indexAsset.source).toString('utf8');
  }

  const configuredLocales = docs.supportedLocales ?? [];
  const locales =
    configuredLocales.length > 0
      ? configuredLocales
      : [...new Set(pages.map((page) => page.locale))];
  const outputPaths = new Set<string>();
  let rootPageHtml: string | undefined;
  for (const page of pages) {
    const fileName = getPageOutputPath(page, locales);
    if (outputPaths.has(fileName)) {
      throw new Error(`Multiple documentation pages map to the same output file: ${fileName}`);
    }
    outputPaths.add(fileName);

    const pageMetadata = {
      ...page.frontmatter,
      title: typeof page.frontmatter['title'] === 'string' ? page.frontmatter['title'] : page.title,
    };
    const html = applyPageMetadata(htmlShell, docs, packageJSON, pageMetadata);
    if (fileName === 'index.html') {
      rootPageHtml = html;
      continue;
    }
    emitFile(fileName, html);
  }

  if (useDefaultHtml) {
    emitFile('index.html', rootPageHtml ?? htmlShell);
  } else if (rootPageHtml) {
    const indexAsset = bundle['index.html'];
    if (!indexAsset || indexAsset.type !== 'asset') {
      throw new Error('Vited could not update index.html with the home page metadata.');
    }
    indexAsset.source = rootPageHtml;
  }
}

export function applyPageMetadata(
  html: string,
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
  frontmatter: Record<string, unknown>,
): string {
  let updatedHtml = applyHtmlMetadata(html, docs, packageJSON);
  if (!/<title\b[^>]*>[\s\S]*?<\/title>/i.test(updatedHtml)) {
    updatedHtml = applyDefaultTitle(updatedHtml, docs, packageJSON);
  }

  if (typeof frontmatter['title'] === 'string') {
    updatedHtml = upsertTitleTag(updatedHtml, frontmatter['title']);
  }
  if (typeof frontmatter['description'] === 'string') {
    updatedHtml = upsertMetaTag(updatedHtml, 'description', frontmatter['description']);
  }
  const keywords = normalizeKeywords(frontmatter['keywords']);
  if (keywords !== undefined) {
    updatedHtml = upsertMetaTag(updatedHtml, 'keywords', keywords);
  }
  return updatedHtml;
}

export function getPageOutputPath(page: DocumentPage, locales: string[]): string {
  const defaultLocale = locales[0] ?? 'en';
  const segments = page.path
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  if (page.locale.toLowerCase() !== defaultLocale.toLowerCase()) {
    segments.unshift(page.locale);
  }
  return path.posix.join(...segments, 'index.html');
}

function applyDefaultTitle(
  html: string,
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
): string {
  const title =
    docs.title ??
    (typeof packageJSON['name'] === 'string' ? packageJSON['name'] : 'Vited documentation');
  return upsertTitleTag(html, title);
}

function normalizeKeywords(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((keyword) => typeof keyword === 'string')) {
    return value.join(', ');
  }
  return;
}

function upsertTitleTag(html: string, title: string): string {
  const tag = `<title>${escapeHtmlAttribute(title)}</title>`;
  const titleTag = /<title\b[^>]*>[\s\S]*?<\/title>/i;
  if (titleTag.test(html)) {
    return html.replace(titleTag, tag);
  }
  return insertHeadTag(html, tag);
}

function upsertMetaTag(html: string, name: string, content: string): string {
  const tag = `<meta name="${name}" content="${escapeHtmlAttribute(content)}" />`;
  let replaced = false;
  const updatedHtml = html.replaceAll(/<meta\b[^>]*>/gi, (metaTag) => {
    if (getMetaName(metaTag) !== name) return metaTag;
    if (replaced) return '';
    replaced = true;
    return tag;
  });
  if (replaced) return updatedHtml;

  return insertHeadTag(updatedHtml, tag);
}

function insertHeadTag(html: string, tag: string): string {
  const headOpen = /<head\b[^>]*>/i;
  if (headOpen.test(html)) {
    return html.replace(headOpen, (match) => `${match}\n    ${tag}`);
  }
  const htmlOpen = /<html\b[^>]*>/i;
  if (htmlOpen.test(html)) {
    return html.replace(htmlOpen, (match) => `${match}\n  <head>\n    ${tag}\n  </head>`);
  }
  return `<head>\n    ${tag}\n  </head>\n${html}`;
}

function getMetaName(metaTag: string): string | undefined {
  const nameMatch = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(metaTag);
  return (nameMatch?.[1] ?? nameMatch?.[2] ?? nameMatch?.[3])?.toLowerCase();
}

function isFaviconLink(linkTag: string): boolean {
  const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(linkTag);
  const rel = relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3];
  return rel?.toLowerCase().split(/\s+/).includes('icon') ?? false;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
