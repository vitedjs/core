import { defineConfig } from '@vited/core';

export default defineConfig({
  base: '/core/',
  server: {
    open: true,
  },
  docs: {
    title: 'Vited Core',
    supportedLocales: ['en', 'zh'],
    siteURL: 'https://vitedjs.github.io/core',
    theme: '@vited/theme-mantine',
  },
});
