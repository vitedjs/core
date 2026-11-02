# AI Agent Guide for `@vited/core`

Use this guide when helping configure Vited in a project that depends on
`@vited/core`. This file is included in the published npm package at
`node_modules/@vited/core/AGENTS.md`.

## What the package does

`@vited/core` integrates Vited's documentation pipeline with Vite. Its
`defineConfig` helper adds the React, Markdown/MDX, and Vited plugins. It
accepts normal Vite options as well as an optional `docs` configuration.
Projects also need `@vited/cli`, a theme package, Vite, React, and React DOM.

## Setup

Install the CLI, core integration, default Mantine theme, and Vite as
development dependencies, and React as runtime dependencies:

```bash
npm install --save-dev @vited/cli @vited/core @vited/theme-mantine vite
npm install react react-dom
```

Add scripts without removing existing project scripts:

```json
{
  "scripts": {
    "docs:dev": "vited dev",
    "docs:build": "vited build"
  }
}
```

Create `vited.config.ts` at the project root:

```ts
import { defineConfig } from '@vited/core';

export default defineConfig({
  base: '/',
  docs: {
    title: 'My Project',
    description: 'Project documentation',
    keywords: ['project', 'documentation'],
    supportedLocales: ['en', 'zh'],
    theme: '@vited/theme-mantine',
  },
});
```

The selected theme package must be installed. `@vited/theme-mantine` is the
default if `docs.theme` is omitted.

## Configuration

`defineConfig` accepts standard Vite options at the top level. Put Vited-specific
settings under `docs`; do not add a separate `docs.root` option.

| `docs` option      | Behavior                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`            | Site title. Defaults to `package.json`'s `name`, then `Vited documentation`.                                                                                                         |
| `description`      | HTML description. Defaults to `package.json`'s `description`.                                                                                                                        |
| `keywords`         | HTML keywords as an array of strings. Defaults to `package.json`'s `keywords`.                                                                                                       |
| `supportedLocales` | Locale codes recognized in file-name suffixes, for example `guide.zh.md`. The first locale is the default and has no locale prefix. If omitted, locales are inferred from documents. |
| `theme`            | Installed theme package name; defaults to `@vited/theme-mantine`.                                                                                                                    |
| `menu`             | Optional sidebar entries. If omitted, the menu is generated from documents.                                                                                                          |

Menu entries can use `text`, `path` for an internal route, `file` for a Markdown
or MDX source file, `link` for an external URL, `flag` (`experimental`, `new`,
or `deprecated`), `children` for nesting, and `divider: true`.

Other common Vite settings remain top-level. Use `base` for a deployment path
prefix. Production output goes to `docs_dist` by default; `build.outDir`
overrides that destination.

## Documents

Documents are read from `<project-root>/docs`. Only `.md` and `.mdx` files
become pages; `.jsx` and `.tsx` files can be imported as components from MDX.
Directories become route segments, and `README.md` is the index for its
directory. Page URLs end in `/`, and the form without the trailing slash also
resolves.

For localization, add the locale before the extension, such as
`guide.zh.md`. With `supportedLocales: ['en', 'zh']`, the first locale uses
unprefixed routes and the other locale uses `/zh/` routes.

Frontmatter supports `title`, `description`, and `keywords` for page metadata.
Use numeric `order` to position generated sidebar entries. Place
`favicon.svg` or `favicon.png` in `docs`; SVG is preferred when both exist.

## Build behavior

Run `npm run docs:dev` for development and `npm run docs:build` for production.
Document edits refresh during development. Production builds emit a page HTML
shell for each document, with frontmatter overriding matching HTML metadata.
Vited uses its built-in HTML shell when the project has no `index.html`.

The theme receives resolved route data and does not need to construct page URLs.
The configured Vite `base` is applied to generated page URLs and assets.
