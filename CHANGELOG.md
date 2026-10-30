# Changelog

## Unreleased

### Added

- Use `docs/favicon.svg` or `docs/favicon.png` as the documentation favicon, preferring SVG.
- Set HTML description and keywords from `docs` configuration or `package.json`.
- Generate an HTML shell for every documentation page, with frontmatter overrides for title, description, and keywords.

### Changed

- Do not add a favicon when the project does not provide one.
- Provide Markdown and MDX frontmatter through the generated pages module instead of a `frontmatter` export, so documents can use React Fast Refresh.
- Only `.md` and `.mdx` files are documentation pages; `.jsx` and `.tsx` files are always treated as components, which pages import from MDX.

### Fixed

- Sort pages that share the same `order` value by route instead of leaving their order undefined.
- Rewrite links to `.mdx` documents into clean URLs, as already done for `.md` links.
- Hot update documentation pages while editing: content edits refresh the page component in place, and frontmatter, added, or removed documents update the sidebar and search index without a full page reload.

## 0.1.1 - 2026-10-28

### Fixed

- Sort pages that share the same `order` value by route instead of leaving their order undefined.
- Rewrite links to `.mdx` documents into clean URLs, as already done for `.md` links.
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
