import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'workbench'),
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  server: {
    port: 4173,
    strictPort: false,
  },
  resolve: {
    alias: {
      '@visual-edit/overlay': resolve(__dirname, 'src/index.ts'),
    },
  },
});
