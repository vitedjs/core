import { readFile } from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

import type { DocumentPage } from './define-config';
import type { LocalizedSite } from './routing';

export interface SearchDocument {
  pathname: string;
  locale: string;
  title: string;
  content: string;
}

export async function createSearchIndex(
  pages: DocumentPage[],
  site: LocalizedSite,
): Promise<SearchDocument[]> {
  return Promise.all(
    pages.map(async (page, index) => {
      const source = await readFile(page.file, 'utf8');
      const parsed = matter(source);
      const title = typeof parsed.data.title === 'string' ? parsed.data.title : page.title;
      const extension = path.extname(page.file).toLowerCase();
      let content = '';

      if (extension === '.md' || extension === '.mdx') {
        const html = marked.parse(parsed.content, { async: false });
        if (typeof html !== 'string') {
          throw new TypeError(`Failed to generate search content for document: ${page.file}`);
        }

        content = sanitizeHtml(
          html
            .replaceAll(/<\/(?:p|h[1-6]|li|pre|blockquote|div)>/gi, ' ')
            .replaceAll(/<br\s*\/?>/gi, ' '),
          { allowedTags: [], allowedAttributes: {} },
        )
          .replaceAll(/\{[^{}]*\}/g, ' ')
          .replaceAll(/\s+/g, ' ')
          .trim();
      }

      return {
        pathname: site.pages[index].pathname,
        locale: page.locale,
        title,
        content,
      };
    }),
  );
}
