import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/clientEntry.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  deps: {
    neverBundle: ['virtual:vited/client'],
  },
});
