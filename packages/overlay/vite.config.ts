import { defineConfig, Plugin, transformWithEsbuild } from 'vite';

const CSS_TEMPLATE_EXPORT_RE = /^export const ([A-Z0-9_]+)\s*=\s*`([\s\S]*)`;\s*$/;

/**
 * Minifies embedded CSS template literals in `styles/*.css.ts` only during production builds
 * so Vitest regex assertions and Workbench dev HMR keep clean source formatting.
 */
function minifyOverlayCssTemplates(): Plugin {
  return {
    name: 'minify-overlay-css-templates',
    apply: 'build',
    enforce: 'pre',
    async transform(code, id) {
      if (!/[/\\]inspector[/\\]styles[/\\][^/\\]+\.css\.ts$/.test(id)) {
        return null;
      }
      const match = CSS_TEMPLATE_EXPORT_RE.exec(code);
      if (!match) {
        return null;
      }
      const [, exportName, cssSource] = match;
      const result = await transformWithEsbuild(cssSource, id.replace(/\.ts$/, ''), {
        loader: 'css',
        minify: true,
      });
      return {
        code: `export const ${exportName} = ${JSON.stringify(result.code)};\n`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [minifyOverlayCssTemplates()],
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
    minify: 'esbuild',
  },
});
