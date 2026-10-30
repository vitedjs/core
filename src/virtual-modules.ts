import type { DocsConfig, DocumentPage } from './define-config';
import type { FaviconLink } from './html';
import type { LocalizedMenuEntry, LocalizedSite } from './routing';

export const pagesModuleId = 'virtual:vited/pages';
export const clientModuleId = 'virtual:vited/client';
export const searchModuleId = 'virtual:vited/search-index';
export const resolvedPagesModuleId = `\0${pagesModuleId}`;
export const resolvedClientModuleId = `\0${clientModuleId}`;
export const resolvedSearchModuleId = `\0${searchModuleId}`;

export function createPagesModule(pages: DocumentPage[], site: LocalizedSite): string {
  const imports = pages.map(
    (page, index) => `import * as doc${index} from ${JSON.stringify(page.file)};`,
  );
  const entries = pages.map((page, index) => {
    const { pathname, url } = site.pages[index];
    return `{
    path: ${JSON.stringify(page.path)},
    locale: ${JSON.stringify(page.locale)},
    pathname: ${JSON.stringify(pathname)},
    url: ${JSON.stringify(url)},
    title: ${JSON.stringify(page.title)},
    frontmatter: ${JSON.stringify(page.frontmatter)},
    component: doc${index}.default
  }`;
  });

  return `${imports.join('\n')}
export const pages = [${entries.join(',\n')}];
export const routes = ${JSON.stringify(site.routes)};
export const routeIndex = ${JSON.stringify(site.routeIndex)};`;
}

export interface ClientModuleData {
  baseURL: string;
  basePath: string;
  locales: string[];
  menu?: LocalizedMenuEntry[];
  favicon?: FaviconLink;
}

export function createClientModule(
  docs: DocsConfig,
  packageJSON: Record<string, unknown>,
  { baseURL, basePath, locales, menu, favicon }: ClientModuleData,
): string {
  const theme = docs.theme ?? '@vited/theme-mantine';
  return `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import Theme from ${JSON.stringify(theme)};
    import { pages, routeIndex, routes } from '${pagesModuleId}';
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
      favicon: ${JSON.stringify(favicon?.href ?? '')},
      supportedLocales: ${JSON.stringify(locales)},
      menu: ${JSON.stringify(menu)},
      packageJSON: ${JSON.stringify(packageJSON)},
      pages,
      routes,
      routeIndex,
      searchIndex,
      baseURL: ${JSON.stringify(baseURL)},
      basePath: ${JSON.stringify(basePath)}
    }));
  `;
}
