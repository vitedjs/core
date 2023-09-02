import { UserConfig as ViteUserConfig } from 'vite';

export function defineConfig(config: UserConfig) {
  return config;
}

export interface UserConfig extends ViteUserConfig {
  /**
   * Configuration of the generated document website.
   */
  docs?: {
    /**
     * Site title. If not specified, name from package.json will be used.
     */
    title?: string;
    /**
     * Site description. If not specified, description from package.json will be used.
     */
    description?: string;
    /**
     * The base URL where the site root is located.
     * @default '/'
     */
    baseURL?: string;
    /**
     * Sidebar menu entries. If not specified, vited will try to parse `docs/` folder.
     */
    menu?: MenuEntry[];
  };
}

export interface MenuEntry {
  /**
   * Render a divider instead of normal menu entry. All other options will be ignored.
   */
  divider?: boolean;
  /**
   * Text content of the menu entry.
   */
  text?: string;
  /**
   * Route path if it is linked to an internal page.
   */
  path?: string;
  /**
   * Document file, *.mdx, *.md, *.jsx, *.tsx
   */
  file?: string;
  /**
   * External link.
   */
  link?: string;
  /**
   * Mark doc entries that need extra attention
   */
  flag?: 'experimental' | 'new' | 'deprecated';
  /**
   * Configure nested menu entries.
   */
  children?: MenuEntry[];
}
