import { readFile } from 'node:fs/promises';
import path from 'node:path';

import mdx from '@mdx-js/rollup';
import { markdownPathToUrlPath } from 'md-url-path';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeMdxCodeProps from 'rehype-mdx-code-props';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkLinkRewrite from 'remark-link-rewrite';
import type { Plugin } from 'vite';

/** `md-url-path` only rewrites `.md` paths, but MDX documents are pages too. */
function rewriteDocumentLink(href: string): string {
  return markdownPathToUrlPath(href.replace(/\.mdx(?=$|[#?])/i, '.md'));
}

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  meta?: string | null;
  value?: string;
};

function remarkCodeSource() {
  return async (tree: MarkdownNode, file: { path?: string }): Promise<void> => {
    const codeNodes: MarkdownNode[] = [];
    const visit = (node: MarkdownNode) => {
      if (node.type === 'code') codeNodes.push(node);
      node.children?.forEach(visit);
    };
    visit(tree);

    await Promise.all(
      codeNodes.map(async (node) => {
        const match = node.meta?.match(/(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/);
        if (!match) return;

        const src = match[1] ?? match[2] ?? match[3];
        if (!src) throw new Error('Code block src attribute must not be empty.');
        if (!file.path)
          throw new Error(`Cannot resolve code block src "${src}" without a file path.`);

        node.value = await readFile(path.resolve(path.dirname(file.path), src), 'utf8');
      }),
    );
  };
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
        remarkGfm,
        [
          remarkLinkRewrite,
          {
            replacer: rewriteDocumentLink,
          },
        ],
        remarkCodeSource,
      ],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: {
              className: ['vited-heading-anchor'],
              ariaHidden: true,
              tabIndex: -1,
            },
            content: { type: 'text', value: '#' },
          },
        ],
        rehypeMdxCodeProps,
      ],
    }),
    enforce: 'pre',
  } as Plugin;
}
