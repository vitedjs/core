# Installation

## Quick start

Create a Vited site with the interactive setup:

```bash
npm create @vited
```

Follow the prompts to choose a project directory, theme, and whether to install
dependencies. The setup creates `vited.config.ts`, a `docs` directory, and
`docs:dev` / `docs:build` scripts.

## Manual setup

To add Vited to an existing project, install the CLI, core integration, default
Mantine theme, and Vite:

```bash
npm install --save-dev @vited/cli @vited/core @vited/theme-mantine vite
npm install react react-dom
```

Add these scripts to your `package.json`, preserving any existing scripts:

```json
{
  "scripts": {
    "docs:dev": "vited dev",
    "docs:build": "vited build"
  }
}
```

Create `vited.config.ts` in the project root:

```ts
import { defineConfig } from '@vited/core';

export default defineConfig({
  docs: {
    title: 'My Project',
    theme: '@vited/theme-mantine',
  },
});
```

Create a `docs` directory and add `docs/README.md` as the home page. Start the
development server or create a production build with:

```bash
npm run docs:dev
npm run docs:build
```

Production builds go to `docs_dist` by default. Add `docs_dist` to `.gitignore`;
set Vite's `build.outDir` if you want to use another output directory.
