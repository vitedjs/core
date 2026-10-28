import path from 'node:path';

import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export async function transformMarkdown(source: string, id: string): Promise<string> {
  const extension = path.extname(id).toLowerCase();
  const parsed = matter(source);
  const frontmatter = JSON.stringify(parsed.data);
  if (extension === '.mdx') {
    const compiled = await compile(parsed.content);
    return `${String(compiled)}\nexport const frontmatter = ${frontmatter};`;
  }

  const html = marked.parse(parsed.content, { async: false });
  if (typeof html !== 'string') {
    throw new TypeError(`Failed to render Markdown document: ${id}`);
  }
  const safeHtml = sanitizeHtml(html, {
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      code: ['class'],
    },
    allowedClasses: {
      code: [/^language-[\w+#.-]+$/],
    },
  });
  return `
        import React from 'react';
        export const frontmatter = ${frontmatter};
        export default function MarkdownDocument({ components = {} }) {
          if (typeof components.html === 'function') {
            return React.createElement(components.html, {
              html: ${JSON.stringify(safeHtml)}
            });
          }
          return React.createElement('div', {
            className: 'vited-markdown',
            dangerouslySetInnerHTML: { __html: ${JSON.stringify(safeHtml)} }
          });
        }
      `;
}
