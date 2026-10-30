import { Buffer } from 'node:buffer';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { build, createServer } from 'vite';
import { describe, expect, it } from 'vitest';

import { defineConfig } from './index';
import { createMdxPlugin } from './mdx-plugin';
import { vitedPlugin } from './plugin';
import {
  pagesModuleId,
  resolvedPagesModuleId,
  resolvedSearchModuleId,
  searchModuleId,
} from './virtual-modules';

describe('vitedPlugin()', () => {
  it('uses the core HTML shell when the project has no index.html', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-build-default-html-'));
    const output = path.join(root, 'docs_dist');
    const projectFavicon =
      '<svg xmlns="http://www.w3.org/2000/svg"><title>project icon</title></svg>';
    try {
      await mkdir(path.join(root, 'docs'), { recursive: true });
      await writeFile(
        path.join(root, 'package.json'),
        JSON.stringify({
          name: 'vited-test-site',
          description: 'Package description',
          keywords: ['package', 'metadata'],
        }),
      );
      await writeFile(path.join(root, 'docs', 'favicon.svg'), projectFavicon);
      await writeFile(
        path.join(root, 'theme.mjs'),
        "import './theme.css'; export default function Theme() { return null; }",
      );
      await writeFile(path.join(root, 'theme.css'), 'body { color: red; }');

      await build({
        configFile: false,
        root,
        plugins: [
          vitedPlugin({
            theme: path.join(root, 'theme.mjs'),
            description: 'Configured & custom',
            keywords: ['configured', 'custom'],
          }),
        ],
        build: {
          rollupOptions: {
            external: ['react', 'react-dom/client', 'react/jsx-runtime'],
          },
        },
      });

      const html = await readFile(path.join(output, 'index.html'), 'utf8');
      expect(html).toContain('<title>vited-test-site</title>');
      expect(html).toContain('<meta name="description" content="Configured &amp; custom" />');
      expect(html).toContain('<meta name="keywords" content="configured, custom" />');
      expect(html).not.toContain('Package description');
      expect(html).toContain('rel="icon" type="image/svg+xml" href="/favicon.svg"');
      expect(await readFile(path.join(output, 'favicon.svg'), 'utf8')).toBe(projectFavicon);
      expect(html).toContain('id="root"');
      expect(html).toContain('type="module"');
      expect(html).toContain('rel="stylesheet"');
      const assetFiles = await readdir(path.join(output, 'assets'));
      const clientFiles = assetFiles.filter((file) => file.endsWith('.js'));
      const clientSources = await Promise.all(
        clientFiles.map((file) => readFile(path.join(output, 'assets', file), 'utf8')),
      );
      const clientBundle = clientSources.join('\n');
      expect(clientBundle).toContain('favicon:');
      expect(clientBundle).toContain('/favicon.svg');
      await expect(readFile(path.join(root, 'index.html'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('builds the core HTML shell without adding a favicon when none is configured', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-build-no-favicon-'));
    const output = path.join(root, 'output');
    try {
      await mkdir(path.join(root, 'docs'), { recursive: true });
      await writeFile(
        path.join(root, 'package.json'),
        JSON.stringify({
          name: 'vited-test-site',
          description: 'Package description',
          keywords: ['package', 'metadata'],
        }),
      );
      await writeFile(
        path.join(root, 'theme.mjs'),
        'export default function Theme() { return null; }',
      );
      await writeFile(
        path.join(root, 'docs', 'README.md'),
        '---\ntitle: Static page title\ndescription: Static page description\nkeywords: [static, page]\n---\n# Body is client-rendered',
      );

      await build({
        configFile: false,
        root,
        plugins: [createMdxPlugin(), vitedPlugin({ theme: path.join(root, 'theme.mjs') })],
        build: {
          outDir: output,
          rollupOptions: {
            external: ['react', 'react-dom/client', 'react/jsx-runtime'],
          },
        },
      });

      const html = await readFile(path.join(output, 'index.html'), 'utf8');
      expect(html).toContain('<title>Static page title</title>');
      expect(html).toContain('<meta name="description" content="Static page description" />');
      expect(html).toContain('<meta name="keywords" content="static, page" />');
      expect(html).not.toContain('<h1>Body is client-rendered</h1>');
      expect(html).not.toContain('rel="icon"');
      expect(html).not.toContain('favicon.svg');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('serves the core HTML shell in development when the project has no index.html', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-dev-default-html-'));
    try {
      await mkdir(path.join(root, 'docs'), { recursive: true });
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'vited-test-site' }));
      const server = await createServer({
        configFile: false,
        root,
        plugins: [vitedPlugin()],
        server: { host: '127.0.0.1', port: 0 },
      });

      try {
        await server.listen();
        const address = server.httpServer?.address();
        if (!address || typeof address === 'string') {
          throw new Error('Vite dev server did not expose a TCP address');
        }

        const { statusCode, html } = await getHtml(`http://127.0.0.1:${address.port}/`);
        expect(statusCode).toBe(200);
        expect(html).toContain('<title>vited-test-site</title>');
        expect(html).not.toContain('rel="icon"');
        expect(html).not.toContain('favicon.svg');
        expect(html).toContain('id="root"');
        expect(html).toContain('/@vite/client');
        await expect(readFile(path.join(root, 'index.html'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('serves the project favicon in development', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-dev-favicon-'));
    const projectFavicon = '<svg xmlns="http://www.w3.org/2000/svg"><title>dev icon</title></svg>';
    try {
      await mkdir(path.join(root, 'docs'), { recursive: true });
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'vited-test-site' }));
      await writeFile(path.join(root, 'docs', 'favicon.svg'), projectFavicon);
      const server = await createServer({
        configFile: false,
        root,
        plugins: [vitedPlugin()],
        server: { host: '127.0.0.1', port: 0 },
      });

      try {
        await server.listen();
        const address = server.httpServer?.address();
        if (!address || typeof address === 'string') {
          throw new Error('Vite dev server did not expose a TCP address');
        }

        const { statusCode, html } = await getHtml(`http://127.0.0.1:${address.port}/`);
        expect(statusCode).toBe(200);
        expect(html).toContain('rel="icon" type="image/svg+xml" href="/favicon.svg"');
        const faviconResponse = await getHtml(`http://127.0.0.1:${address.port}/favicon.svg`);
        expect(faviconResponse.statusCode).toBe(200);
        expect(faviconResponse.html).toBe(projectFavicon);
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('hot updates documents without regenerating pages for content-only edits', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-dev-hmr-'));
    const docsRoot = path.join(root, 'docs');
    const documentFile = path.join(docsRoot, 'README.md');
    try {
      await mkdir(docsRoot, { recursive: true });
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'vited-test-site' }));
      await writeFile(documentFile, '---\ntitle: Home\n---\n# Home\n');
      await writeFile(
        path.join(root, 'jsx-stub.mjs'),
        'export const Fragment = Symbol.for("react.fragment");\nexport const jsx = () => null;\nexport const jsxs = () => null;\nexport const jsxDEV = () => null;\n',
      );

      const server = await createServer({
        configFile: false,
        root,
        plugins: [createMdxPlugin(), vitedPlugin()],
        logLevel: 'silent',
        resolve: { alias: { 'react/jsx-dev-runtime': path.join(root, 'jsx-stub.mjs') } },
        server: { host: '127.0.0.1', port: 0 },
      });

      try {
        await server.listen();
        const environment = server.environments.client;
        await environment.transformRequest('/docs/README.md?import');
        const pagesModuleSource = await environment.transformRequest(pagesModuleId);
        await environment.transformRequest(searchModuleId);
        expect(pagesModuleSource?.code).toContain('frontmatter: {"title":"Home"}');

        const plugin = server.config.plugins.find(({ name }) => name === 'vited');
        const hotUpdate = plugin?.hotUpdate;
        if (typeof hotUpdate !== 'function') {
          throw new TypeError('vited plugin does not implement hotUpdate()');
        }
        const documentModules = [...(environment.moduleGraph.getModulesByFile(documentFile) ?? [])];
        const pluginContext = { environment } as unknown as ThisParameterType<typeof hotUpdate>;
        const hotUpdateOptions = (type: 'update' | 'delete') => ({
          type,
          file: documentFile,
          timestamp: Date.now(),
          modules: documentModules,
          read: () => readFile(documentFile, 'utf8'),
          server,
        });

        await writeFile(documentFile, '---\ntitle: Home\n---\n# Home page\n');
        const contentModules = await hotUpdate.call(pluginContext, hotUpdateOptions('update'));
        expect(contentModules?.map(({ id }) => id)).toEqual(documentModules.map(({ id }) => id));

        await writeFile(documentFile, '---\ntitle: Home page\n---\n# Home page\n');
        const metadataModules = await hotUpdate.call(pluginContext, hotUpdateOptions('update'));
        expect(metadataModules?.map(({ id }) => id)).toEqual(
          expect.arrayContaining([
            ...documentModules.map(({ id }) => id),
            resolvedPagesModuleId,
            resolvedSearchModuleId,
          ]),
        );

        const deletedModules = await hotUpdate.call(pluginContext, hotUpdateOptions('delete'));
        expect(deletedModules?.map(({ id }) => id)).not.toContain(documentModules[0]?.id);
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('compiles documents into React Refresh boundaries in development', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-dev-refresh-'));
    try {
      await mkdir(path.join(root, 'docs'), { recursive: true });
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'vited-test-site' }));
      await writeFile(path.join(root, 'docs', 'README.md'), '---\ntitle: Home\n---\n# Home\n');
      await writeFile(
        path.join(root, 'jsx-stub.mjs'),
        'export const Fragment = Symbol.for("react.fragment");\nexport const jsx = () => null;\nexport const jsxs = () => null;\nexport const jsxDEV = () => null;\n',
      );

      const config = defineConfig({});
      const server = await createServer({
        ...config,
        configFile: false,
        root,
        logLevel: 'silent',
        resolve: {
          ...config.resolve,
          dedupe: [],
          alias: { 'react/jsx-dev-runtime': path.join(root, 'jsx-stub.mjs') },
        },
        server: { host: '127.0.0.1', port: 0 },
      });

      try {
        await server.listen();
        const documentModule =
          await server.environments.client.transformRequest('/docs/README.md?import');
        expect(documentModule?.code).toContain('import.meta.hot.accept');
        expect(documentModule?.code).toContain('$RefreshReg$');
        expect(documentModule?.code).not.toContain('export const frontmatter');
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves a custom index favicon when the docs directory has none', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-build-custom-favicon-'));
    const output = path.join(root, 'docs_dist');
    try {
      await mkdir(path.join(root, 'docs'), { recursive: true });
      await writeFile(
        path.join(root, 'package.json'),
        JSON.stringify({
          name: 'vited-test-site',
          description: 'Package description',
          keywords: ['package', 'metadata'],
        }),
      );
      await writeFile(
        path.join(root, 'index.html'),
        '<html><head><link rel="icon" href="/custom.ico"></head><body></body></html>',
      );
      await writeFile(
        path.join(root, 'theme.mjs'),
        'export default function Theme() { return null; }',
      );

      await build({
        configFile: false,
        root,
        plugins: [vitedPlugin({ theme: path.join(root, 'theme.mjs') })],
        build: {
          rollupOptions: {
            external: ['react', 'react-dom/client', 'react/jsx-runtime'],
          },
        },
      });

      const html = await readFile(path.join(output, 'index.html'), 'utf8');
      expect(html).toContain('<link rel="icon" href="/custom.ico">');
      expect(html).toContain('<meta name="description" content="Package description" />');
      expect(html).toContain('<meta name="keywords" content="package, metadata" />');
      expect(html).not.toContain('favicon.svg');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('builds a site with recursively discovered Markdown and MDX pages', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-build-'));
    const docsRoot = path.join(root, 'docs');
    const output = path.join(root, 'output');
    try {
      await mkdir(path.join(docsRoot, 'guide'), { recursive: true });
      await writeFile(path.join(root, 'index.html'), '<html><body></body></html>');
      await writeFile(
        path.join(root, 'package.json'),
        JSON.stringify({
          name: 'vited-test-site',
          description: 'Global site description',
          keywords: ['global', 'site'],
          repository: 'https://github.com/vitedjs/vited-test-site.git',
          funding: { type: 'github', url: 'https://github.com/sponsors/vitedjs' },
        }),
      );
      await writeFile(
        path.join(root, 'theme.mjs'),
        'export default function Theme() { return null; }',
      );
      await writeFile(
        path.join(docsRoot, 'README.md'),
        '---\ntitle: Home page SEO\ndescription: Home page description\nkeywords:\n  - home\n  - docs\n---\n# Documentation home\n\n[Installation](./installation.md) [Home](./README.md) [Nested home](./foo/bar/README.md) [MDX guide](./guide/start.mdx) [External](https://example.com/guide.md)\n\n```c#\nconst markdownValue = "highlighted markdown";\n```',
      );
      await writeFile(
        path.join(docsRoot, 'guide', 'no-frontmatter.md'),
        '# **Page title from heading**\n\nPage content.',
      );
      const projectFavicon = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      await writeFile(path.join(docsRoot, 'favicon.png'), projectFavicon);
      await writeFile(
        path.join(docsRoot, 'guide', 'start.zh.mdx'),
        '---\ntitle: 开始\ndescription: Guide page description\nkeywords: [guide, start]\n---\n# Getting started\n\nUnique searchable phrase.\n\n[Previous](../no-frontmatter.md#heading)\n\n```js\nconst mdxValue = "highlighted mdx";\n```',
      );
      await build({
        configFile: false,
        root,
        base: '/docs-site/',
        plugins: [
          createMdxPlugin(),
          vitedPlugin({
            supportedLocales: ['en', 'zh'],
            theme: path.join(root, 'theme.mjs'),
          }),
        ],
        build: {
          outDir: output,
          rollupOptions: {
            external: ['react', 'react-dom/client', 'react/jsx-runtime'],
          },
        },
      });

      const html = await readFile(path.join(output, 'index.html'), 'utf8');
      const localizedPageHtml = await readFile(
        path.join(output, 'zh', 'guide', 'start', 'index.html'),
        'utf8',
      );
      const noFrontmatterPageHtml = await readFile(
        path.join(output, 'guide', 'no-frontmatter', 'index.html'),
        'utf8',
      );
      const scripts = await collectJavaScript(output);
      const bundle = scripts.join('\n');

      expect(html).toContain('href="/docs-site/favicon.png"');
      expect(await readFile(path.join(output, 'favicon.png'))).toEqual(projectFavicon);
      expect(html).toContain('<title>Home page SEO</title>');
      expect(html).toContain('<meta name="description" content="Home page description" />');
      expect(html).toContain('<meta name="keywords" content="home, docs" />');
      expect(html).toContain('id="root"');
      expect(localizedPageHtml).toContain('<title>开始</title>');
      expect(localizedPageHtml).toContain(
        '<meta name="description" content="Guide page description" />',
      );
      expect(localizedPageHtml).toContain('<meta name="keywords" content="guide, start" />');
      expect(localizedPageHtml).not.toContain('<h1');
      expect(localizedPageHtml).not.toContain('Unique searchable phrase.');
      expect(noFrontmatterPageHtml).toContain('<title>Page title from heading</title>');
      expect(bundle).toContain('/guide/start');
      expect(bundle).toContain('Documentation home');
      expect(bundle).toContain('Getting started');
      expect(bundle).toContain('开始');
      expect(bundle).toContain('Unique searchable phrase.');
      expect(bundle).toMatch(/baseURL.{0,32}\/docs-site\//s);
      expect(bundle).toContain('name:`vited-test-site`');
      expect(bundle).toContain('https://github.com/vitedjs/vited-test-site.git');
      expect(bundle).toContain('https://github.com/sponsors/vitedjs');
      expect(bundle).toContain('language-js');
      expect(bundle).toContain('language-c#');
      expect(bundle).toContain('markdownValue');
      expect(bundle).toContain('mdxValue');
      expect(bundle).toContain('href:`./installation/`');
      expect(bundle).toContain('href:`./guide/start/`');
      expect(bundle).not.toContain('guide/start.mdx');
      expect(bundle).not.toContain('./installation.md');
      expect(bundle).toContain('href:`./`');
      expect(bundle).not.toContain('./README.md');
      expect(bundle).toContain('href:`./foo/bar/`');
      expect(bundle).not.toContain('./foo/bar/README.md');
      expect(bundle).toContain('../no-frontmatter/#heading');
      expect(bundle).toContain('https://example.com/guide.md');
      expect(bundle).not.toContain('dangerouslySetInnerHTML');
      expect(bundle).not.toContain('<h1>Documentation home</h1>');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function collectJavaScript(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectJavaScript(file);
      if (entry.isFile() && entry.name.endsWith('.js')) return [await readFile(file, 'utf8')];
      return [];
    }),
  );
  return contents.flat();
}

function getHtml(url: string): Promise<{ statusCode: number | undefined; html: string }> {
  return new Promise((resolve, reject) => {
    const request = get(url, { headers: { accept: 'text/html' } }, (response) => {
      let html = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        html += chunk;
      });
      response.on('end', () => resolve({ statusCode: response.statusCode, html }));
    });
    request.on('error', reject);
  });
}
