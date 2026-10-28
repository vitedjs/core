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
  supportedLocales: ['en', 'zh'],
}
```

Vited reads documentation from the `docs` directory under the project root.

Fenced code blocks are syntax-highlighted by the default Mantine theme when
their language is specified on the fence, for example TypeScript or JavaScript.

## MDX and React components

See [Using React components in MDX](./mdx-components.mdx) for an example of
importing and rendering a React component from an MDX document.

`README.zh.md` translates the home page and `guide/README.zh.md` translates
this guide. English uses the unprefixed route, while Chinese routes use the
`/zh/` prefix, such as `/zh/guide`.
