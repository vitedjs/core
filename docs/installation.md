# Installation

## Quick start

Create a Vited site or add Vited to an existing project with the interactive
setup:

```bash
npm create @vited
```

Run the command from the target project directory, or choose another directory
when prompted. Follow the prompts to choose a theme and whether to install
dependencies. The setup creates `vited.config.ts` if needed, a `docs` directory,
and `docs:dev` / `docs:build` scripts.

## Manual setup

Alternatively, to set up Vited manually in an existing project, install the CLI,
core integration, default Mantine theme, and Vite:

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

Create a `docs` directory and add `docs/README.md` as the home page.

## Run and build

Both the interactive and manual setups provide the `docs:dev` and `docs:build`
scripts.

### Development server

Start the local development server with:

```bash
npm run docs:dev
```

### Production build

Create a production build with:

```bash
npm run docs:build
```

Production builds go to `docs_dist` by default. Add `docs_dist` to `.gitignore`;
set Vite's `build.outDir` if you want to use another output directory.
