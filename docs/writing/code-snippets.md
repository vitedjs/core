---
title: Code snippets
order: 33
---

# Code snippets

Wrap code in a fenced block and put the language after the opening backticks:

````md
```ts
export function add(a: number, b: number): number {
  return a + b;
}
```
````

The default Mantine theme highlights such blocks with Shiki, adds a copy button,
and follows the light and dark color schemes. Common languages such as `ts`,
`tsx`, `js`, `jsx`, `json`, `bash`, `yaml`, `diff`, and `md` work out of the box.

Leave the language empty for plain text:

```text
plain text without highlighting
```

## Inline code

Wrap names, paths, and short expressions in single backticks, for example
`npm run docs:dev` or `vited.config.ts`.

## Live components

MDX documents can render React components next to code blocks, so a snippet and
a working example can live in the same page. See
[Using React components in MDX](./react-components.mdx).
