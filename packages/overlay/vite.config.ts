import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VisualEditOverlay',
      fileName: () => 'overlay.js',
      formats: ['es'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
});
