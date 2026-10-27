---
title: Getting started
---

# Getting started

Create a `docs` directory and add Markdown files. Use `README.md` for a
directory's index page; nested directories become route segments.

For example, `docs/guide/README.md` is available at `/guide`.

## Languages

Set `supportedLocales` in `vited.config.ts`, then add a locale suffix to each
translated document:

```ts
docs: {
  root: './docs',
  supportedLocales: ['en', 'zh'],
}
```

`README.zh.md` translates the home page and `guide/README.zh.md` translates
this guide. English uses the unprefixed route, while Chinese routes use the
`/zh/` prefix, such as `/zh/guide`.
