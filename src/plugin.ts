import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import type { DocsConfig, DocumentPage } from './define-config';
import { scanDocs } from './documents';
import {
  applyHtmlMetadata,
  createDefaultDocumentHtml,
  emitStaticHtmlPages,
  replaceFaviconLink,
  readProjectFavicon,
  type Favicon,
} from './html';
import { transformMarkdown } from './markdown';
import { createSearchIndex } from './search-index';
import {
  clientModuleId,
  createClientModule,
  createPagesModule,
  pagesModuleId,
  resolvedClientModuleId,
  resolvedPagesModuleId,
  resolvedSearchModuleId,
  searchModuleId,
} from './virtual-modules';

const builtClientEntry = fileURLToPath(new URL('client-entry.mjs', import.meta.url));
const sourceClientEntry = fileURLToPath(new URL('client-entry.ts', import.meta.url));
const clientEntry = existsSync(builtClientEntry) ? builtClientEntry : sourceClientEntry;

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
        return transformMarkdown(source, id);
      }
    },
    generateBundle: {
      order: 'post',
      async handler(_outputOptions, bundle) {
        await emitStaticHtmlPages({
          bundle,
          clientEntry,
          baseURL,
          useDefaultHtml,
          pages,
          docs,
          packageJSON,
          favicon,
          emitFile: (fileName, source) => this.emitFile({ type: 'asset', fileName, source }),
        });
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
