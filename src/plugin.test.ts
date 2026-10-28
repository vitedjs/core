import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { build } from 'vite';
import { describe, expect, it } from 'vitest';

import { vitedPlugin } from './plugin';

describe('vitedPlugin()', () => {
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
        '---\ntitle: Welcome\n---\n# Documentation home\n\n```c#\nconst markdownValue = "highlighted markdown";\n```',
      );
      await writeFile(
        path.join(docsRoot, 'guide', 'start.zh.mdx'),
        '---\ntitle: 开始\n---\n# Getting started\n\nUnique searchable phrase.\n\n```js\nconst mdxValue = "highlighted mdx";\n```',
      );

      await build({
        configFile: false,
        root,
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
      const scripts = await collectJavaScript(output);
      const bundle = scripts.join('\n');

      expect(html).toContain('id="root"');
      expect(bundle).toContain('/guide/start');
      expect(bundle).toContain('Documentation home');
      expect(bundle).toContain('Getting started');
      expect(bundle).toContain('开始');
      expect(bundle).toContain('Unique searchable phrase.');
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
