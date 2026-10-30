---
title: Writing documents
order: 30
---

# Writing documents

Add documents to the `docs` directory. Vited makes pages out of Markdown
(`.md`) and MDX (`.mdx`) files. Other files are not pages, so `.jsx` and `.tsx`
components can live anywhere in the project and be imported by a document.

Directory names become route segments and `README.md` is the index page of its
directory. Put a supported locale suffix before the extension to translate a
page, for example `guide.zh.md`.

## Metadata

Start a document with a YAML frontmatter block. The metadata sets the sidebar
entry, the page title, and the HTML head of production builds.

```md
---
title: Installation
order: 10
description: Install Vited in an existing project.
keywords: [installation, setup]
---
```

A document without metadata takes its title from the first level-one heading.

## React components

MDX documents can import and render React components. See
[Using React components in MDX](./guide/mdx-components.mdx) for an example.

## Fields

- `title`: Page title. It labels the sidebar entry and becomes the HTML title of
  production builds.
- `order`: Number that positions the page in a generated sidebar. Lower values
  come first; pages without `order` follow pages with one.
- `description`: HTML description meta tag of production builds.
- `keywords`: HTML keywords meta tag of production builds, as a list of strings.

Themes receive the whole metadata object as `page.frontmatter`, so custom fields
are allowed.
