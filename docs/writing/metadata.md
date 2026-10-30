---
title: Metadata
order: 32
---

# Metadata

Start a document with a YAML frontmatter block:

```md
---
title: Installation
order: 10
description: Install Vited in an existing project.
keywords: [installation, setup]
---
```

Vited reads the metadata while scanning documents. It sets the sidebar entry, the
page title, and the HTML head of production builds, and themes receive the whole
object as `page.frontmatter`.

## Fields

- `title`: Page title. It labels the sidebar entry and becomes the HTML title of
  production builds. A document without `title` uses its first level-one heading.
- `order`: Number that positions the page in a generated sidebar. Lower values
  come first; pages without `order` follow pages with one.
- `description`: HTML description meta tag of production builds.
- `keywords`: HTML keywords meta tag of production builds, as a list of strings.

Pages are grouped by route in the sidebar, so give a directory index page
(`README.md`) a lower `order` than its children to keep the group in place.

## Custom fields

Any other field is kept in `page.frontmatter`, so themes and components can read
project-specific values:

```md
---
title: Release notes
draft: true
---
```
