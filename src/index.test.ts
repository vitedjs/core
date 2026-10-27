import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defineConfig, getPageRoute, scanDocs } from './index';

describe('defineConfig()', () => {
  it('preserves Vite options and adds the Vited plugin', () => {
    const config = defineConfig({
      base: '/manual/',
      docs: { root: './handbook', supportedLocales: ['en', 'zh'] },
    });

    expect(config.base).toBe('/manual/');
    expect(config.plugins).toHaveLength(1);
    expect(config.docs?.root).toBe('./handbook');
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
    expect(getPageRoute('api/client.tsx', ['en'])).toEqual({
      route: '/api/client',
      locale: 'en',
    });
    expect(getPageRoute('api/intro.pt-br.md', ['en', 'pt-BR'])).toEqual({
      route: '/api/intro',
      locale: 'pt-BR',
    });
  });
});

describe('scanDocs()', () => {
  it('recursively finds supported document files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-docs-'));
    try {
      await mkdir(path.join(root, 'guide'));
      await writeFile(path.join(root, 'README.md'), '# Home');
      await writeFile(path.join(root, 'guide', 'start.zh.mdx'), '# 开始');
      await writeFile(path.join(root, 'guide', 'example.tsx'), 'export default () => null');
      await writeFile(path.join(root, 'ignored.txt'), 'ignored');

      const pages = await scanDocs(root, ['en', 'zh']);

      expect(pages.map(({ path: route, locale }) => [route, locale])).toEqual([
        ['/', 'en'],
        ['/guide/example', 'en'],
        ['/guide/start', 'zh'],
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
