---
title: Configuration
order: 20
---

# Configuration

Vited is configured in `vited.config.ts` at the project root. Use
`defineConfig` from `@vited/core`:

```ts
import { defineConfig } from '@vited/core';

export default defineConfig({
  base: '/docs/',
  build: {
    outDir: 'site-dist',
  },
  docs: {
    title: 'My Project',
    description: 'Project documentation',
    keywords: ['project', 'documentation'],
    supportedLocales: ['en', 'zh'],
    theme: '@vited/theme-mantine',
  },
});
```

`defineConfig` accepts the standard Vite configuration and adds Vited's document
and MDX plugins. Put Vited-specific options inside `docs`; all other options,
such as `base`, `build`, and `server`, are standard Vite options. See the [Vite
configuration guide](https://vite.dev/config/).

## Vited options

| Option             | Description                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`            | Site title. Defaults to the `name` in `package.json`, or `Vited documentation` if no package name is available.                                                              |
| `description`      | HTML description metadata. Defaults to the `description` in `package.json`.                                                                                                  |
| `keywords`         | HTML keywords as an array of strings. Defaults to `keywords` in `package.json`.                                                                                              |
| `supportedLocales` | Locale codes recognized in filenames such as `guide.zh.md`. The first locale is the default and uses unprefixed routes. If omitted, locales are inferred from the documents. |
| `theme`            | Theme package to render the site. Defaults to `@vited/theme-mantine`.                                                                                                        |
| `menu`             | Sidebar menu entries. If omitted, the menu is generated from the documentation pages.                                                                                        |

### Custom menu

Menu entries can link to documentation routes or external URLs, and can be
nested:

```ts
docs: {
  menu: [
    { text: 'Guide', path: '/guide' },
    { text: 'API reference', link: 'https://example.com/api' },
    {
      text: 'More',
      children: [{ text: 'Configuration', path: '/configuration' }],
    },
  ],
}
```

An entry can use these properties:

| Property   | Description                                                                    |
| ---------- | ------------------------------------------------------------------------------ |
| `text`     | Menu label.                                                                    |
| `path`     | Internal documentation route, such as `/guide`.                                |
| `file`     | Documentation source file (`.md`, `.mdx`, `.jsx`, or `.tsx`).                  |
| `link`     | External URL.                                                                  |
| `divider`  | Set to `true` to render a divider; other properties on that entry are ignored. |
| `flag`     | Optional marker: `experimental`, `new`, or `deprecated`.                       |
| `children` | Nested menu entries.                                                           |

## Document ordering

When the sidebar is generated from documentation pages, set a numeric `order`
in Markdown or MDX frontmatter to position a page manually. Lower values appear
first; pages without an `order` follow pages with one. Pages with equal order
values, and unordered pages, are sorted by route.

```md
---
title: Installation
order: 10
---
```

## Vite options

Vited supports Vite's normal configuration options. For example, set [`base`
in Vite](https://vite.dev/config/shared-options.html#base) when deploying under
a path prefix. Vited writes production builds to `docs_dist` by default; set
[`build.outDir` in Vite](https://vite.dev/config/build-options.html#build-outdir)
to use a different directory.
