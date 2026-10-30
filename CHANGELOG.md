# Changelog

## 0.3.0 - 2026-10-30

### Added

- Resolve page URLs in Vited, so themes consume data instead of building paths: pages carry `pathname` and `url`, and themes receive `routes`, `routeIndex`, `basePath`, and menu entries with `pathnames` and `urls` per locale.
- `routes` covers every page route in every configured locale, including the page that renders it and the translation it falls back to.
- Search documents carry the `pathname` that opens the page.

### Changed

- Page URLs are directory style and end with a slash (`/guide/start/`, `/zh/guide/start/`). Routes resolve with and without the trailing slash.

## 0.2.0 - 2026-10-30

### Added

- Compile Markdown and MDX documents with the React plugin, so pages are React Refresh boundaries in development.

### Changed

- Provide Markdown and MDX frontmatter through the generated pages module instead of a `frontmatter` export, so documents can use React Fast Refresh.
- Only `.md` and `.mdx` files are documentation pages; `.jsx` and `.tsx` files are always treated as components, which pages import from MDX.

### Fixed

- Hot update documentation pages while editing: content edits refresh the page component in place, and frontmatter, added, or removed documents update the sidebar and search index without a full page reload.
- Sort pages that share the same `order` value by route instead of leaving their order undefined.
- Rewrite links to `.mdx` documents into clean URLs, as already done for `.md` links.

## 0.1.2 - 2026-10-29

### Added

- Use `docs/favicon.svg` or `docs/favicon.png` as the documentation favicon, preferring SVG.
- Set HTML description and keywords from `docs` configuration or `package.json`.
- Generate an HTML shell for every documentation page, with frontmatter overrides for title, description, and keywords.

### Changed

- Do not add a favicon when the project does not provide one.

## 0.1.1 - 2026-10-28

### Fixed

- Provide a built-in HTML shell when a project does not have an `index.html`, for both development and production builds.

## 0.1.0 - 2026-10-27

Initial release.

### Added

- Vite integration for discovering and rendering Markdown, MDX, JSX, and TSX documentation pages.
- Frontmatter-based page titles and localized routes using locale-prefixed URLs.
- Generated search index and project `package.json` metadata for themes.
- Sanitized Markdown rendering and configurable documentation themes.

### Changed

- Documentation is read from the `docs` directory under the Vite project root; the `docs.root` option is not supported.
