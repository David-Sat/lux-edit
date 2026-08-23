import { defineConfig } from 'tsup';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  clean: true,
  dts: false,
  sourcemap: false,
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  noExternal: ['@visual-edit/core', '@visual-edit/mcp', '@visual-edit/overlay', '@visual-edit/server'],
  async onSuccess() {
    // Copy overlay bundle into dist
    const overlaySrc = path.resolve(__dirname, '../overlay/dist/overlay.js');
    const overlayDest = path.resolve(__dirname, 'dist/overlay.js');
    if (fs.existsSync(overlaySrc)) {
      fs.copyFileSync(overlaySrc, overlayDest);
    }
    // Make cli.js executable
    const cliPath = path.resolve(__dirname, 'dist/cli.js');
    if (fs.existsSync(cliPath)) {
      fs.chmodSync(cliPath, 0o755);
    }
  },
});
