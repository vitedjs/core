import mdx from '@mdx-js/rollup';
import { markdownPathToUrlPath } from 'md-url-path';
import remarkFrontmatter from 'remark-frontmatter';
import remarkLinkRewrite from 'remark-link-rewrite';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

export function createMdxPlugin() {
  return mdx({
    include: /\.mdx?$/i,
    remarkPlugins: [
      remarkFrontmatter,
      remarkMdxFrontmatter,
      [
        remarkLinkRewrite,
        {
          replacer: markdownPathToUrlPath,
        },
      ],
    ],
  });
}
