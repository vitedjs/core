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
  type FaviconLink,
} from './html';
import {
  createLocalizedMenu,
  createLocalizedSite,
  normalizeBaseURL,
  resolveLocales,
} from './routing';
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
  let faviconLink: FaviconLink | undefined;
  let baseURL = '/';
  let useDefaultHtml = false;
  let packageJSON: Record<string, unknown> = {};
  let pages: DocumentPage[] = [];

  return {
    name: 'vited',
    enforce: 'pre',
    config(config, environment) {
      if (environment.command !== 'build') return;

      const root = path.resolve(config.root ?? process.cwd());
      const build: NonNullable<typeof config.build> = {};
      if (config.build?.outDir === undefined) build.outDir = 'docs_dist';
      const rollupOptions = config.build?.rolldownOptions ?? config.build?.rollupOptions;
      const onLog = rollupOptions?.onLog;
      build.rolldownOptions = {
        ...rollupOptions,
        onLog(level, log, defaultHandler) {
          if (log.code === 'MODULE_LEVEL_DIRECTIVE') return;
          if (onLog) {
            onLog(level, log, defaultHandler);
          } else {
            defaultHandler(level, log);
          }
        },
      };
      if (!existsSync(path.join(root, 'index.html'))) {
        useDefaultHtml = true;
        if (rollupOptions?.input === undefined) {
          build.rolldownOptions = {
            ...rollupOptions,
            ...build.rolldownOptions,
            input: clientEntry,
          };
        }
      }
      return Object.keys(build).length > 0 ? { build } : undefined;
    },
    async configResolved(resolvedConfig) {
      docsRoot = path.resolve(resolvedConfig.root, 'docs');
      packageJsonPath = path.join(resolvedConfig.root, 'package.json');
      baseURL = resolvedConfig.base;
      favicon = await readProjectFavicon(docsRoot);
      const basePath = normalizeBaseURL(baseURL);
      faviconLink = favicon
        ? {
            type: favicon.type,
            href: `${basePath === '/' ? '' : basePath}/${favicon.fileName}`,
          }
        : undefined;
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
        return createPagesModule(pages, createLocalizedSite(pages, docs.supportedLocales, baseURL));
      }
      if (id === resolvedSearchModuleId) {
        pages = await scanDocs(docsRoot, docs.supportedLocales);
        const site = createLocalizedSite(pages, docs.supportedLocales, baseURL);
        const searchIndex = await createSearchIndex(pages, site);
        return `export default ${JSON.stringify(searchIndex)};`;
      }
      if (id === resolvedClientModuleId) {
        pages = await scanDocs(docsRoot, docs.supportedLocales);
        const locales = resolveLocales(pages, docs.supportedLocales);
        const basePath = normalizeBaseURL(baseURL);
        return createClientModule(docs, packageJSON, {
          baseURL,
          basePath: basePath === '/' ? '' : basePath,
          locales,
          menu: createLocalizedMenu(docs.menu, locales, baseURL),
          favicon: faviconLink,
        });
      }
    },
    generateBundle: {
      order: 'post',
      async handler(_outputOptions, bundle) {
        if (favicon) {
          this.emitFile({ type: 'asset', fileName: favicon.fileName, source: favicon.source });
        }
        await emitStaticHtmlPages({
          bundle,
          clientEntry,
          baseURL,
          useDefaultHtml,
          pages,
          docs,
          packageJSON,
          favicon: faviconLink,
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
        const faviconResult = replaceFaviconLink(withMetadata, faviconLink);
        return {
          html: faviconResult.html,
          tags: [
            ...(faviconLink && faviconResult.injectFavicon
              ? [
                  {
                    tag: 'link' as const,
                    attrs: {
                      rel: 'icon',
                      type: faviconLink.type,
                      href: faviconLink.href,
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

      if (faviconLink && favicon) {
        const faviconFile = favicon;
        const faviconPath = new URL(faviconLink.href, 'http://localhost').pathname;
        server.middlewares.use((request, response, next) => {
          if ((request.url ?? '').split('?')[0] !== faviconPath) {
            next();
            return;
          }
          response.setHeader('Content-Type', faviconFile.type);
          response.end(faviconFile.source);
        });
      }

      if (!existsSync(path.join(server.config.root, 'index.html'))) {
        server.middlewares.use((request, response, next) => {
          if (request.method !== 'GET' || !request.headers.accept?.includes('text/html')) {
            next();
            return;
          }

          const shellHtml = createDefaultDocumentHtml(faviconLink, docs, packageJSON);
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
    async hotUpdate(context) {
      if (this.environment.config.consumer !== 'client') return;

      const moduleGraph = this.environment.moduleGraph;

      if (context.file === packageJsonPath) {
        packageJSON = await readPackageJson(packageJsonPath);
        const clientModule = moduleGraph.getModuleById(resolvedClientModuleId);
        if (!clientModule) return;
        moduleGraph.invalidateModule(clientModule);
        return [clientModule];
      }

      const relativePath = path.relative(docsRoot, context.file);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return;

      const previousPages = pages;
      pages = await scanDocs(docsRoot, docs.supportedLocales);

      // Documents that were removed have no module left to update.
      const modules = new Set(context.type === 'delete' ? [] : context.modules);

      // Content-only edits are handled by the React Refresh boundary of the document module
      // itself. Pages module and search index only need to be regenerated when the page
      // list or its metadata changed.
      if (documentsChanged(previousPages, pages)) {
        for (const id of [resolvedPagesModuleId, resolvedSearchModuleId]) {
          const module = moduleGraph.getModuleById(id);
          if (module) {
            moduleGraph.invalidateModule(module);
            modules.add(module);
          }
        }
      }

      return [...modules];
    },
  };
}

function documentsChanged(previous: DocumentPage[], next: DocumentPage[]): boolean {
  if (previous.length !== next.length) return true;
  return next.some((page, index) => {
    const before = previous[index];
    return (
      before.file !== page.file ||
      before.path !== page.path ||
      before.locale !== page.locale ||
      before.title !== page.title ||
      !hasSameFrontmatter(before.frontmatter, page.frontmatter)
    );
  });
}

function hasSameFrontmatter(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  return JSON.stringify(previous) === JSON.stringify(next);
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
