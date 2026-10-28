import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { Plugin } from 'vite';

import type { DocsConfig, DocumentPage } from './define-config';
import { scanDocs } from './documents';
import { createSearchIndex } from './search-index';

const pagesModuleId = 'virtual:vited/pages';
const clientModuleId = 'virtual:vited/client';
const searchModuleId = 'virtual:vited/search-index';
const resolvedPagesModuleId = `\0${pagesModuleId}`;
const resolvedClientModuleId = `\0${clientModuleId}`;
const resolvedSearchModuleId = `\0${searchModuleId}`;
const builtClientEntry = fileURLToPath(new URL('client-entry.mjs', import.meta.url));
const sourceClientEntry = fileURLToPath(new URL('client-entry.ts', import.meta.url));
const clientEntry = existsSync(builtClientEntry) ? builtClientEntry : sourceClientEntry;

interface Favicon {
  type: 'image/svg+xml' | 'image/png';
  href: string;
}

function createDefaultHtml(favicon?: Favicon): string {
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

async function readProjectFavicon(docsRoot: string): Promise<Favicon | undefined> {
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

export function vitedPlugin(docs: DocsConfig = {}): Plugin {
  let docsRoot: string;
  let packageJsonPath: string;
  let favicon: Favicon | undefined;
  let baseURL = '/';
  let useDefaultHtml = false;
  let packageJSON: Record<string, unknown> = {};
  let pages: DocumentPage[] = [];

  return {
    name: 'vited',
    enforce: 'pre',
    config(config, environment) {
      if (environment.command !== 'build' || config.build?.rollupOptions?.input !== undefined) {
        return;
      }

      const root = path.resolve(config.root ?? process.cwd());
      if (!existsSync(path.join(root, 'index.html'))) {
        useDefaultHtml = true;
        return {
          build: {
            rollupOptions: {
              input: clientEntry,
            },
          },
        };
      }
    },
    async configResolved(resolvedConfig) {
      docsRoot = path.resolve(resolvedConfig.root, 'docs');
      packageJsonPath = path.join(resolvedConfig.root, 'package.json');
      baseURL = resolvedConfig.base;
      favicon = await readProjectFavicon(docsRoot);
      packageJSON = await readPackageJson(packageJsonPath);
    },
    async buildStart() {
      pages = await scanDocs(docsRoot, docs.supportedLocales);
      for (const page of pages) {
        this.addWatchFile(page.file);
      }
    },
    resolveId(id) {
      if (id === pagesModuleId) return resolvedPagesModuleId;
      if (id === clientModuleId) return resolvedClientModuleId;
      if (id === searchModuleId) return resolvedSearchModuleId;
    },
    async load(id) {
      if (id === resolvedPagesModuleId) {
        pages = await scanDocs(docsRoot, docs.supportedLocales);
        return createPagesModule(pages);
      }
      if (id === resolvedSearchModuleId) {
        pages = await scanDocs(docsRoot, docs.supportedLocales);
        const searchIndex = await createSearchIndex(pages);
        return `export default ${JSON.stringify(searchIndex)};`;
      }
      if (id === resolvedClientModuleId) {
        return createClientModule(docs, packageJSON, baseURL);
      }
    },
    async transform(source, id) {
      const extension = path.extname(id).toLowerCase();
      const relativePath = path.relative(docsRoot, id);
      if (
        ['.md', '.mdx'].includes(extension) &&
        !relativePath.startsWith('..') &&
        !path.isAbsolute(relativePath)
      ) {
        const parsed = matter(source);
        const frontmatter = JSON.stringify(parsed.data);
        if (extension === '.mdx') {
          const compiled = await compile(parsed.content);
          return `${String(compiled)}\nexport const frontmatter = ${frontmatter};`;
        }

        const html = marked.parse(parsed.content, { async: false });
        if (typeof html !== 'string') {
          throw new TypeError(`Failed to render Markdown document: ${id}`);
        }
        const safeHtml = sanitizeHtml(html, {
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            code: ['class'],
          },
          allowedClasses: {
            code: [/^language-[\w+#.-]+$/],
          },
        });
        return `
        import React from 'react';
        export const frontmatter = ${frontmatter};
        export default function MarkdownDocument({ components = {} }) {
          if (typeof components.html === 'function') {
            return React.createElement(components.html, {
              html: ${JSON.stringify(safeHtml)}
            });
          }
          return React.createElement('div', {
            className: 'vited-markdown',
            dangerouslySetInnerHTML: { __html: ${JSON.stringify(safeHtml)} }
          });
        }
      `;
      }
    },
    generateBundle: {
      order: 'post',
      async handler(_outputOptions, bundle) {
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
            throw new Error(
              'Vited could not find index.html to generate static documentation pages.',
            );
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
            throw new Error(
              `Multiple documentation pages map to the same output file: ${fileName}`,
            );
          }
          outputPaths.add(fileName);

          const frontmatter = await readPageFrontmatter(page);
          const html = applyPageMetadata(htmlShell, docs, packageJSON, frontmatter);
          if (fileName === 'index.html') {
            rootPageHtml = html;
            continue;
          }
          this.emitFile({ type: 'asset', fileName, source: html });
        }

        if (useDefaultHtml) {
          this.emitFile({
            type: 'asset',
            fileName: 'index.html',
            source: rootPageHtml ?? htmlShell,
          });
        } else if (rootPageHtml) {
          const indexAsset = bundle['index.html'];
          if (!indexAsset || indexAsset.type !== 'asset') {
            throw new Error('Vited could not update index.html with the home page metadata.');
          }
          indexAsset.source = rootPageHtml;
        }
      },
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const withRoot = /id=["']root["']/.test(html)
          ? html
          : html.replace(/<body([^>]*)>/i, '<body$1><div id="root"></div>');
        const withMetadata = applyHtmlMetadata(withRoot, docs, packageJSON);
        const faviconResult = replaceFaviconLink(withMetadata, favicon);
        return {
          html: faviconResult.html,
          tags: [
            ...(favicon && faviconResult.injectFavicon
              ? [
                  {
                    tag: 'link' as const,
                    attrs: {
                      rel: 'icon',
                      type: favicon.type,
                      href: favicon.href,
                    },
                    injectTo: 'head-prepend' as const,
                  },
                ]
              : []),
            {
              tag: 'script',
              attrs: {
                type: 'module',
                src: toFileUrl(clientEntry),
              },
              injectTo: 'body',
            },
          ],
        };
      },
    },
    configureServer(server) {
      server.watcher.add(docsRoot);
      server.watcher.add(packageJsonPath);

      if (!existsSync(path.join(server.config.root, 'index.html'))) {
        server.middlewares.use((request, response, next) => {
          if (request.method !== 'GET' || !request.headers.accept?.includes('text/html')) {
            next();
            return;
          }

          const shellHtml = createDefaultDocumentHtml(favicon, docs, packageJSON);
          void server
            .transformIndexHtml(request.url ?? '/', shellHtml)
            .then((transformedHtml) => {
              response.statusCode = 200;
              response.setHeader('Content-Type', 'text/html');
              response.end(transformedHtml);
            })
            .catch(next);
        });
      }
    },
    async handleHotUpdate(context) {
      if (context.file === packageJsonPath) {
        packageJSON = await readPackageJson(packageJsonPath);
        const clientModule = context.server.moduleGraph.getModuleById(resolvedClientModuleId);
        if (clientModule) {
          context.server.moduleGraph.invalidateModule(clientModule);
          return [clientModule];
        }
        return;
      }

      const relativePath = path.relative(docsRoot, context.file);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return;
      pages = await scanDocs(docsRoot, docs.supportedLocales);
      const pagesModule = context.server.moduleGraph.getModuleById(resolvedPagesModuleId);
      const searchModule = context.server.moduleGraph.getModuleById(resolvedSearchModuleId);
      for (const module of [pagesModule, searchModule]) {
        if (module) context.server.moduleGraph.invalidateModule(module);
      }
      return [
        ...new Set(
          [...context.modules, pagesModule, searchModule].filter((module) => module !== undefined),
        ),
      ];
    },
  };
}

function createPagesModule(pages: DocumentPage[]): string {
  const imports = pages.map(
    (page, index) => `import * as doc${index} from ${JSON.stringify(page.file)};`,
  );
  const entries = pages.map((page, index) => {
    const hasFrontmatter = ['.md', '.mdx'].includes(path.extname(page.file).toLowerCase());
    const title = hasFrontmatter
      ? `typeof doc${index}.frontmatter?.title === 'string'
      ? doc${index}.frontmatter.title
      : ${JSON.stringify(page.title)}`
      : JSON.stringify(page.title);
    const frontmatter = hasFrontmatter ? `doc${index}.frontmatter ?? {}` : '{}';
    return `{
    path: ${JSON.stringify(page.path)},
    locale: ${JSON.stringify(page.locale)},
    title: ${title},
    frontmatter: ${frontmatter},
    component: doc${index}.default
  }`;
  });

  return `${imports.join('\n')}\nexport default [${entries.join(',\n')}];`;
}

function createClientModule(
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
  baseURL: string,
): string {
  const theme = docs.theme ?? '@vited/theme-mantine';
  return `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import Theme from ${JSON.stringify(theme)};
    import pages from '${pagesModuleId}';
    import searchIndex from '${searchModuleId}';
    const target = document.getElementById('root');
    if (!target) throw new Error('Vited could not find the #root element in index.html');
    createRoot(target).render(React.createElement(Theme, {
      title: ${JSON.stringify(docs.title ?? '')},
      description: ${JSON.stringify(docs.description ?? '')},
      supportedLocales: ${JSON.stringify(docs.supportedLocales ?? [])},
      menu: ${JSON.stringify(docs.menu)},
      packageJSON: ${JSON.stringify(packageJSON)},
      pages,
      searchIndex,
      baseURL: ${JSON.stringify(baseURL)}
    }));
  `;
}

async function readPackageJson(file: string): Promise<Record<string, unknown>> {
  let source: string;
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) return {};
    throw new Error(`Failed to read project package.json at ${file}`, { cause: error });
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid project package.json at ${file}`, { cause: error });
  }
  if (!isRecord(value)) {
    throw new Error(`Project package.json must contain a JSON object: ${file}`);
  }
  return value;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFileUrl(file: string): string {
  return `/@fs/${file.replaceAll('\\', '/').replace(/^\/+/, '')}`;
}

function replaceFaviconLink(
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

function isFaviconLink(linkTag: string): boolean {
  const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(linkTag);
  const rel = relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3];
  return rel?.toLowerCase().split(/\s+/).includes('icon') ?? false;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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

function applyPageMetadata(
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

function applyHtmlMetadata(
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

function createDefaultDocumentHtml(
  favicon: Favicon | undefined,
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
): string {
  const shell = createDefaultHtml(favicon);
  const titledShell = applyDefaultTitle(shell, docs, packageJSON);
  return applyHtmlMetadata(titledShell, docs, packageJSON);
}

async function readPageFrontmatter(page: DocumentPage): Promise<Record<string, unknown>> {
  const extension = path.extname(page.file).toLowerCase();
  if (extension !== '.md' && extension !== '.mdx') return {};

  try {
    const source = await readFile(page.file, 'utf8');
    const frontmatter: unknown = matter(source).data;
    return isRecord(frontmatter) ? frontmatter : {};
  } catch (error) {
    throw new Error(`Failed to read frontmatter for documentation page ${page.file}`, {
      cause: error,
    });
  }
}

function getPageOutputPath(page: DocumentPage, locales: string[]): string {
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
