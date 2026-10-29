import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkLinkRewrite from 'remark-link-rewrite';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

function rewriteMarkdownLinks(url: string) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) {
    return url;
  }

  const directoryUrl = url.replace(/(^|\/)README\.mdx?(?=[?#]|$)/i, '$1');
  if (directoryUrl !== url) {
    return directoryUrl || './';
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
