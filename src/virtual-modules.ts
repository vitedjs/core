import type { DocsConfig, DocumentPage } from './define-config';

export const pagesModuleId = 'virtual:vited/pages';
export const clientModuleId = 'virtual:vited/client';
export const searchModuleId = 'virtual:vited/search-index';
export const resolvedPagesModuleId = `\0${pagesModuleId}`;
export const resolvedClientModuleId = `\0${clientModuleId}`;
export const resolvedSearchModuleId = `\0${searchModuleId}`;

export function createPagesModule(pages: DocumentPage[]): string {
  const imports = pages.map(
    (page, index) => `import * as doc${index} from ${JSON.stringify(page.file)};`,
  );
  const entries = pages.map(
    (page, index) => `{
    path: ${JSON.stringify(page.path)},
    locale: ${JSON.stringify(page.locale)},
    title: ${JSON.stringify(page.title)},
    frontmatter: ${JSON.stringify(page.frontmatter)},
    component: doc${index}.default
  }`,
  );

  return `${imports.join('\n')}\nexport default [${entries.join(',\n')}];`;
}

export function createClientModule(
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
  baseURL: string,
): string {
  const theme = docs.theme ?? '@vited/theme-mantine';
  return `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import Theme from ${JSON.stringify(theme)};
    import pages from '${pagesModuleId}';
    import searchIndex from '${searchModuleId}';
    const target = document.getElementById('root');
    if (!target) throw new Error('Vited could not find the #root element in index.html');
    const root = import.meta.hot?.data.root ?? createRoot(target);
    if (import.meta.hot) {
      import.meta.hot.data.root = root;
      import.meta.hot.accept();
    }
    root.render(React.createElement(Theme, {
      title: ${JSON.stringify(docs.title ?? '')},
      description: ${JSON.stringify(docs.description ?? '')},
      supportedLocales: ${JSON.stringify(docs.supportedLocales ?? [])},
      menu: ${JSON.stringify(docs.menu)},
      packageJSON: ${JSON.stringify(packageJSON)},
      pages,
      searchIndex,
      baseURL: ${JSON.stringify(baseURL)}
    }));
  `;
}
