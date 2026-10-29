import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

export function createMdxPlugin() {
  return mdx({
    include: /\.mdx?$/i,
    remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
  });
}
