import { readFile } from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

import type { DocumentPage } from './defineConfig';

export interface SearchDocument {
  path: string;
  locale: string;
  title: string;
  content: string;
}

export async function createSearchIndex(pages: DocumentPage[]): Promise<SearchDocument[]> {
  return Promise.all(
    pages.map(async (page) => {
      const source = await readFile(page.file, 'utf8');
      const parsed = matter(source);
      const title = typeof parsed.data.title === 'string' ? parsed.data.title : page.title;
      const extension = path.extname(page.file).toLowerCase();
      let content = '';

      if (extension === '.md' || extension === '.mdx') {
        const html = marked.parse(parsed.content, { async: false });
        if (typeof html !== 'string') {
          throw new Error(`Failed to generate search content for document: ${page.file}`);
        }

        content = sanitizeHtml(
          html
            .replace(/<\/(?:p|h[1-6]|li|pre|blockquote|div)>/gi, ' ')
            .replace(/<br\s*\/?>/gi, ' '),
          { allowedTags: [], allowedAttributes: {} },
        )
          .replace(/\{[^{}]*\}/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      return { path: page.path, locale: page.locale, title, content };
    }),
  );
}
