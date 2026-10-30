import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createLocalizedSite } from './routing';
import { createSearchIndex } from './search-index';

describe('createSearchIndex()', () => {
  it('creates localized plain-text entries using frontmatter titles', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vited-search-'));
    try {
      const file = path.join(root, 'guide.zh.md');
      await writeFile(file, '---\ntitle: 中文指南\n---\n# 搜索示例\n\n查找 **文档内容**。');

      const pages = [
        {
          path: '/guide',
          locale: 'zh',
          title: 'guide',
          file,
          frontmatter: {},
        },
      ];

      await expect(
        createSearchIndex(pages, createLocalizedSite(pages, ['en', 'zh'])),
      ).resolves.toEqual([
        {
          pathname: '/zh/guide/',
          locale: 'zh',
          title: '中文指南',
          content: '搜索示例 查找 文档内容。',
        },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
