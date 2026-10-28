# @vited/core

Vited's core package integrates the documentation pipeline with Vite. It keeps
Vite's configuration intact and adds document discovery, frontmatter parsing,
Markdown/MDX transforms, and a virtual React entry point for the selected theme.

## Configuration

```ts
import { defineConfig } from '@vited/core';

export default defineConfig({
  docs: {
    title: 'My Cool Library',
    supportedLocales: ['en', 'zh'],
    theme: '@vited/theme-mantine',
  },
});
```

Vited reads documents from the `docs` directory under the Vite project root.
Vited discovers `.jsx`, `.tsx`, `.md`, and `.mdx` recursively. Directory
names form route segments, `README.md` is the directory index, and a supported
locale suffix such as `guide.zh.md` selects that locale. The first configured
locale uses the unprefixed route; other locales use a `/<locale>/` prefix. For example,
`README.zh.md` is available at `/zh/`. Markdown frontmatter is available as
each page's `frontmatter`; its `title` becomes the page title.

Fenced code blocks in Markdown and MDX are syntax-highlighted by the selected
theme when a language is specified on the fence (for example, TypeScript or
JavaScript). The default Mantine theme uses Shiki with `@mantine/code-highlight`
and provides copy controls and light/dark color schemes.

Vited passes the project's `package.json` object to the theme as `packageJSON`.
The default Mantine theme uses its `repository` and `funding` fields for
optional GitHub and Donate links in the header.

The default Mantine theme also provides local document search. Vited builds a
search index from Markdown and MDX titles and text; results are scoped to the
selected locale. Open search with the Search button or `Ctrl+K` / `⌘K`.

The [development guide](./docs/guide/README.md) demonstrates nested pages and
English/Chinese documentation.

Vited uses its built-in HTML shell when the project does not include an
`index.html`; if one exists, Vited uses that file. The built-in shell provides a
`<body>` element and a `#root` mount point for the selected React theme.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```
