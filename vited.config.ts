import { defineConfig } from '@vited/core';

export default defineConfig({
  base: '/core/',
  server: {
    open: true,
  },
  docs: {
    title: 'Vited Core',
    supportedLocales: ['en', 'zh'],
    theme: '@vited/theme-mantine',
  },
});
