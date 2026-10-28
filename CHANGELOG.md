# Changelog

## Unreleased

### Added

- Add an original Vited SVG favicon to the default documentation HTML shell.

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
