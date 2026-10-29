import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkLinkRewrite from 'remark-link-rewrite';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

function rewriteMarkdownLinks(url: string) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) {
    return url;
  }

  return url.replace(/\.mdx?(?=[?#]|$)/i, '');
}

export function createMdxPlugin() {
  return mdx({
    include: /\.mdx?$/i,
    remarkPlugins: [
      remarkFrontmatter,
      remarkMdxFrontmatter,
      [remarkLinkRewrite, { replacer: rewriteMarkdownLinks }],
    ],
  });
}
