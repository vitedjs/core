import mdx from '@mdx-js/rollup';
import { markdownPathToUrlPath } from 'md-url-path';
import remarkFrontmatter from 'remark-frontmatter';
import remarkLinkRewrite from 'remark-link-rewrite';
import type { Plugin } from 'vite';

/** `md-url-path` only rewrites `.md` paths, but MDX documents are pages too. */
function rewriteDocumentLink(href: string): string {
  return markdownPathToUrlPath(href.replace(/\.mdx(?=$|[#?])/i, '.md'));
}

export function createMdxPlugin(): Plugin {
  // Compile during the `pre` stage, so that the generated module is still processed by the
  // React Refresh transform and becomes an HMR boundary. Refreshable modules may only export
  // components, therefore frontmatter is provided by the pages module instead.
  return {
    ...mdx({
      include: /\.mdx?$/i,
      remarkPlugins: [
        remarkFrontmatter,
        [
          remarkLinkRewrite,
          {
            replacer: rewriteDocumentLink,
          },
        ],
      ],
    }),
    enforce: 'pre',
  } as Plugin;
}
