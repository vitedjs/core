# Changelog

## 0.1.0 - 2026-10-27

Initial release.

### Added

- Vite integration for discovering and rendering Markdown, MDX, JSX, and TSX documentation pages.
- Frontmatter-based page titles and localized routes using locale-prefixed URLs.
- Generated search index and project `package.json` metadata for themes.
- Sanitized Markdown rendering and configurable documentation themes.

### Changed

- Documentation is read from the `docs` directory under the Vite project root; the `docs.root` option is not supported.
