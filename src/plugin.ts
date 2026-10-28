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
    async generateBundle(_outputOptions, bundle) {
      if (!useDefaultHtml) return;

      const clientChunk = Object.values(bundle).find(
        (output) =>
          output.type === 'chunk' && output.isEntry && output.facadeModuleId === clientEntry,
      );
      if (!clientChunk || clientChunk.type !== 'chunk') {
        throw new Error('Vited could not find the built client entry for its HTML shell.');
      }

      const html = applyDefaultTitle(createDefaultHtml(favicon), docs, packageJSON);
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
      const htmlWithClient = htmlWithStyles.replace(
        '</body>',
        `    <script type="module" src="${scriptSrc}"></script>\n  </body>`,
      );
      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: htmlWithClient,
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const withRoot = /id=["']root["']/.test(html)
          ? html
          : html.replace(/<body([^>]*)>/i, '<body$1><div id="root"></div>');
        const faviconResult = replaceFaviconLink(withRoot, favicon);
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

          void server
            .transformIndexHtml(
              request.url ?? '/',
              applyDefaultTitle(createDefaultHtml(favicon), docs, packageJSON),
            )
            .then((html) => {
              response.statusCode = 200;
              response.setHeader('Content-Type', 'text/html');
              response.end(html);
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
  const entries = pages.map(
    (page, index) => `{
    path: ${JSON.stringify(page.path)},
    locale: ${JSON.stringify(page.locale)},
    title: typeof doc${index}.frontmatter?.title === 'string'
      ? doc${index}.frontmatter.title
      : ${JSON.stringify(page.title)},
    frontmatter: doc${index}.frontmatter ?? {},
    component: doc${index}.default
  }`,
  );

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
  return html.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlAttribute(title)}</title>`,
  );
}
