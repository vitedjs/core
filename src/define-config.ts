import type { UserConfig as ViteUserConfig } from 'vite';

import { createMdxPlugin } from './mdx-plugin';
import { vitedPlugin } from './plugin';

export function defineConfig(config: UserConfig): UserConfig {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      dedupe: [...new Set([...(config.resolve?.dedupe ?? []), 'react', 'react-dom'])],
    },
    plugins: [createMdxPlugin(), ...(config.plugins ?? []), vitedPlugin(config.docs)],
  };
}

export interface UserConfig extends ViteUserConfig {
  /** Configuration of the generated document website. */
  docs?: DocsConfig;
}

export interface DocsConfig {
  /** Site title. If not specified, name from package.json will be used. */
  title?: string;
  /** Site description. If not specified, description from package.json will be used. */
  description?: string;
  /** HTML keywords. If not specified, keywords from package.json will be used. */
  keywords?: string[];
  /** Locales recognized in document filenames such as `intro.zh.md`. */
  supportedLocales?: string[];
  /**
   * Theme package whose default export is a React component.
   *
   * @default '@vited/theme-mantine'
   */
  theme?: string;
  /** Sidebar menu entries. If not specified, Vited builds the menu from docs. */
  menu?: MenuEntry[];
}

export interface DocumentPage {
  path: string;
  locale: string;
  title: string;
  file: string;
  frontmatter: Record<string, unknown>;
}

export interface MenuEntry {
  /** Render a divider instead of normal menu entry. All other options will be ignored. */
  divider?: boolean;
  /** Text content of the menu entry. */
  text?: string;
  /** Route path if it is linked to an internal page. */
  path?: string;
  /** Document file, *.mdx, *.md, *.jsx, *.tsx */
  file?: string;
  /** External link. */
  link?: string;
  /** Mark doc entries that need extra attention */
  flag?: 'experimental' | 'new' | 'deprecated';
  /** Configure nested menu entries. */
  children?: MenuEntry[];
}
