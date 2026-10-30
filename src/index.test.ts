import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { defineConfig, getPageRoute, scanDocs } from './index';

describe('defineConfig()', () => {
  it('preserves Vite options and adds the Vited plugin', () => {
    const config = defineConfig({
      base: '/manual/',
      docs: { supportedLocales: ['en', 'zh'] },
    });

    expect(config.base).toBe('/manual/');
    expect(config.resolve?.dedupe).toEqual(['react', 'react-dom']);
    expect(config.plugins).toHaveLength(3);
    expect(config.docs?.supportedLocales).toEqual(['en', 'zh']);
  });

  it('keeps existing Vite dedupe entries', () => {
    const config = defineConfig({
      resolve: { dedupe: ['some-library', 'react'] },
    });

    expect(config.resolve?.dedupe).toEqual(['some-library', 'react', 'react-dom']);
  });
});

describe('getPageRoute()', () => {
  it('maps README files to their directory route and extracts locales', () => {
    expect(getPageRoute('guide/README.zh.md', ['en', 'zh'])).toEqual({
      route: '/guide',
      locale: 'zh',
    });
    expect(getPageRoute('README.md', ['en', 'zh'])).toEqual({
      route: '/',
      locale: 'en',
    });
  });

  it('preserves directory hierarchy and ignores unsupported suffixes', () => {
    expect(getPageRoute('api/overview.pt.md', ['en', 'zh'])).toEqual({
      route: '/api/overview.pt',
      locale: 'en',
    });
    expect(getPageRoute('api/intro.pt-br.md', ['en', 'pt-BR'])).toEqual({
      route: '/api/intro',
      locale: 'pt-BR',
    });
  });

  it('rejects files that are not Markdown documents', () => {
    expect(() => getPageRoute('api/client.tsx', ['en'])).toThrow(
      'Unsupported documentation file extension: api/client.tsx',
    );
    expect(() => getPageRoute('api/client.page.jsx', ['en'])).toThrow(
      'Unsupported documentation file extension: api/client.page.jsx',
    );
  });
});

describe('scanDocs()', () => {
  it('recursively finds supported document files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-docs-'));
    try {
      await mkdir(path.join(root, 'guide'));
      await writeFile(path.join(root, 'README.md'), '# Home');
      await writeFile(path.join(root, 'guide', 'start.zh.mdx'), '# 开始');
      await writeFile(path.join(root, 'guide', 'component.tsx'), 'export default () => null');
      await writeFile(path.join(root, 'guide', 'component.page.tsx'), 'export default () => null');
      await writeFile(path.join(root, 'ignored.txt'), 'ignored');

      const pages = await scanDocs(root, ['en', 'zh']);

      expect(pages.map(({ path: route, locale }) => [route, locale])).toEqual([
        ['/', 'en'],
        ['/guide/start', 'zh'],
      ]);
      expect(pages.map(({ title }) => title)).toEqual(['Home', '开始']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses the first level-one Markdown heading as the page title', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-doc-titles-'));
    try {
      await writeFile(
        path.join(root, 'guide.md'),
        '## Not the page title\n\n```md\n# Heading in a code block\n```\n\n# **First** page title\n\n# Later heading',
      );
      await writeFile(
        path.join(root, 'guide.zh.md'),
        '---\ntitle: Frontmatter title\n---\n# Heading title',
      );

      const pages = await scanDocs(root, ['en', 'zh']);

      expect(pages.map(({ title }) => title)).toEqual(['First page title', 'Frontmatter title']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('sorts pages by frontmatter order before unordered pages', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-doc-order-'));
    try {
      await writeFile(path.join(root, 'README.md'), '---\norder: 0\n---\n# Home');
      await writeFile(path.join(root, 'installation.md'), '---\norder: 10\n---\n# Installation');
      await writeFile(path.join(root, 'configuration.md'), '---\norder: 20\n---\n# Configuration');
      await writeFile(path.join(root, 'reference.md'), '# Reference');

      const pages = await scanDocs(root);

      expect(pages.map(({ path: route }) => route)).toEqual([
        '/',
        '/installation',
        '/configuration',
        '/reference',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
