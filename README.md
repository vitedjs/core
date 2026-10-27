# @vited/core

Vited's core package integrates the documentation pipeline with Vite. It keeps
Vite's configuration intact and adds document discovery, frontmatter parsing,
Markdown/MDX transforms, and a virtual React entry point for the selected theme.

## Configuration

```ts
import { defineConfig } from '@vited/core';

export default defineConfig({
  docs: {
    root: './docs',
    title: 'My Cool Library',
    supportedLocales: ['en', 'zh'],
    theme: '@vited/theme-mantine',
  },
});
```

`docs.root` is relative to the Vite project root. Vited discovers `.jsx`, `.tsx`,
`.md`, and `.mdx` recursively. Directory names form route segments,
`README.md` is the directory index, and a supported locale suffix such as
`guide.zh.md` selects that locale. The first configured locale uses the
unprefixed route; other locales use a `/<locale>/` prefix. For example,
`README.zh.md` is available at `/zh/`. Markdown frontmatter is available as
each page's `frontmatter`; its `title` becomes the page title.

The [development guide](./docs/guide/README.md) demonstrates nested pages and
English/Chinese documentation.

The application needs an `index.html` with a `<body>` element. Vited inserts a
`#root` mount element when one is not present and loads the selected React theme
automatically.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```
