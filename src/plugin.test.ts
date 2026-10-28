import { Buffer } from 'node:buffer';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { build, createServer } from 'vite';
import { describe, expect, it } from 'vitest';

import { vitedPlugin } from './plugin';

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
      expect(html).toContain('rel="icon" type="image/svg+xml"');
      expect(html).toContain(`href="data:image/svg+xml,${encodeURIComponent(projectFavicon)}"`);
      expect(html).toContain('id="root"');
      expect(html).toContain('type="module"');
      expect(html).toContain('rel="stylesheet"');
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
        plugins: [vitedPlugin({ theme: path.join(root, 'theme.mjs') })],
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
      expect(html).not.toContain('data:image/svg+xml,');
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
        expect(html).not.toContain('data:image/svg+xml,');
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
      expect(html).not.toContain('data:image/svg+xml,');
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
      await mkdir(path.join(docsRoot, 'api'), { recursive: true });
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
        '---\ntitle: Home page SEO\ndescription: Home page description\nkeywords:\n  - home\n  - docs\n---\n# Documentation home\n\n```c#\nconst markdownValue = "highlighted markdown";\n```',
      );
      const projectFavicon = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      await writeFile(path.join(docsRoot, 'favicon.png'), projectFavicon);
      await writeFile(
        path.join(docsRoot, 'guide', 'start.zh.mdx'),
        '---\ntitle: 开始\ndescription: Guide page description\nkeywords: [guide, start]\n---\n# Getting started\n\nUnique searchable phrase.\n\n```js\nconst mdxValue = "highlighted mdx";\n```',
      );
      await writeFile(
        path.join(docsRoot, 'api', 'client.tsx'),
        'export default function ClientPage() { return null; }',
      );

      await build({
        configFile: false,
        root,
        base: '/docs-site/',
        plugins: [
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
      const componentPageHtml = await readFile(
        path.join(output, 'api', 'client', 'index.html'),
        'utf8',
      );
      const scripts = await collectJavaScript(output);
      const bundle = scripts.join('\n');

      expect(html).toContain(`href="data:image/png;base64,${projectFavicon.toString('base64')}"`);
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
      expect(componentPageHtml).toContain(
        '<meta name="description" content="Global site description" />',
      );
      expect(componentPageHtml).toContain('<meta name="keywords" content="global, site" />');
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
