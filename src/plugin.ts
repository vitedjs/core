import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { Plugin } from 'vite';
import type { DocsConfig, DocumentPage } from './defineConfig';
import { scanDocs } from './documents';
import { createSearchIndex } from './search-index';

const pagesModuleId = 'virtual:vited/pages';
const clientModuleId = 'virtual:vited/client';
const searchModuleId = 'virtual:vited/search-index';
const resolvedPagesModuleId = `\0${pagesModuleId}`;
const resolvedClientModuleId = `\0${clientModuleId}`;
const resolvedSearchModuleId = `\0${searchModuleId}`;
const builtClientEntry = fileURLToPath(new URL('./clientEntry.mjs', import.meta.url));
const sourceClientEntry = fileURLToPath(new URL('./clientEntry.ts', import.meta.url));

export function vitedPlugin(docs: DocsConfig = {}): Plugin {
  let docsRoot: string;
  let packageJsonPath: string;
  let packageJSON: Record<string, unknown> = {};
  let pages: DocumentPage[] = [];

  return {
    name: 'vited',
    enforce: 'pre',
    async configResolved(resolvedConfig) {
      docsRoot = path.resolve(resolvedConfig.root, docs.root ?? './docs');
      packageJsonPath = path.join(resolvedConfig.root, 'package.json');
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
      return null;
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
        return createClientModule(docs, packageJSON);
      }
      return null;
    },
    async transform(source, id) {
      const extension = path.extname(id).toLowerCase();
      const relativePath = path.relative(docsRoot, id);
      if (
        !['.md', '.mdx'].includes(extension) ||
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath)
      ) {
        return null;
      }

      const parsed = matter(source);
      const frontmatter = JSON.stringify(parsed.data);
      if (extension === '.mdx') {
        const compiled = await compile(parsed.content);
        return `${String(compiled)}\nexport const frontmatter = ${frontmatter};`;
      }

      const html = marked.parse(parsed.content, { async: false });
      if (typeof html !== 'string') {
        throw new Error(`Failed to render Markdown document: ${id}`);
      }
      const safeHtml = sanitizeHtml(html);
      return `
        import React from 'react';
        export const frontmatter = ${frontmatter};
        export default function MarkdownDocument() {
          return React.createElement('div', {
            className: 'vited-markdown',
            dangerouslySetInnerHTML: { __html: ${JSON.stringify(safeHtml)} }
          });
        }
      `;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const withRoot = /id=["']root["']/.test(html)
          ? html
          : html.replace(/<body([^>]*)>/i, '<body$1><div id="root"></div>');
        return {
          html: withRoot,
          tags: [
            {
              tag: 'script',
              attrs: {
                type: 'module',
                src: toFileUrl(existsSync(builtClientEntry) ? builtClientEntry : sourceClientEntry),
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
      return [...new Set([
        ...context.modules,
        pagesModule,
        searchModule,
      ].filter((module) => module !== undefined))];
    },
  };
}

function createPagesModule(pages: DocumentPage[]): string {
  const imports = pages.map((page, index) =>
    `import * as doc${index} from ${JSON.stringify(page.file)};`,
  );
  const entries = pages.map((page, index) => `{
    path: ${JSON.stringify(page.path)},
    locale: ${JSON.stringify(page.locale)},
    title: typeof doc${index}.frontmatter?.title === 'string'
      ? doc${index}.frontmatter.title
      : ${JSON.stringify(page.title)},
    frontmatter: doc${index}.frontmatter ?? {},
    component: doc${index}.default
  }`);

  return `${imports.join('\n')}\nexport default [${entries.join(',\n')}];`;
}

function createClientModule(
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
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
      menu: ${JSON.stringify(docs.menu ?? null)},
      packageJSON: ${JSON.stringify(packageJSON)},
      pages,
      searchIndex,
      baseURL: ${JSON.stringify(docs.baseURL ?? '/')}
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
  return `/@fs/${file.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}
