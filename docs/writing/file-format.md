---
title: File format
order: 31
---

# File format

Vited reads documents from the `docs` directory under the project root. Only
`.md` and `.mdx` files become pages; every other file is ignored, so React
components (`.jsx`, `.tsx`) can live anywhere in the project and be imported by a
document.

```text
docs/
  README.md               → /
  installation.md         → /installation
  installation.zh.md      → /zh/installation
  guide/
    README.md             → /guide
    start.mdx             → /guide/start
    Callout.tsx           → not a page, imported by start.mdx
```

## Routes

Directory names become route segments, and the file name becomes the last
segment: `docs/guide/start.mdx` is available at `/guide/start`.

`README.md` is the index page of its directory, so `docs/guide/README.md` is
available at `/guide`.

## Languages

Set `supportedLocales` in `vited.config.ts`, then add a locale suffix before the
extension to translate a page:

```ts
docs: {
  supportedLocales: ['en', 'zh'],
}
```

The first configured locale uses the unprefixed route. Other locales are
available at a `/<locale>/` prefix, so `installation.zh.md` is available at
`/zh/installation`.
