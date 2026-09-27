import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DEMO_HTML_TEMPLATE } from '../demo-template.js';
import { VisualEditServer } from '@visual-edit/server';

describe('lux demo playground', () => {
  const testDir = path.join(os.tmpdir(), `lux-demo-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('scaffolds demo HTML template and updates .gitignore', () => {
    const demoDir = path.join(testDir, 'lux-demo');
    const demoFile = path.join(demoDir, 'index.html');
    const gitignorePath = path.join(testDir, '.gitignore');

    fs.mkdirSync(demoDir, { recursive: true });
    fs.writeFileSync(demoFile, DEMO_HTML_TEMPLATE, 'utf-8');

    let gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
    if (!gitignore.includes('/lux-demo')) {
      gitignore += (gitignore.endsWith('\n') || gitignore.length === 0 ? '' : '\n') + '/lux-demo/\n';
      fs.writeFileSync(gitignorePath, gitignore, 'utf-8');
    }

    expect(fs.existsSync(demoFile)).toBe(true);
    const content = fs.readFileSync(demoFile, 'utf-8');
    expect(content).toContain('Lux Interactive Playground');
    expect(content).toContain('Station 01 // Direct Visual Editing');
    expect(content).toContain('HYPERFAST DEVLOPMENT ENGINE');
    expect(content).toContain('BETA v0.9');
    expect(content).toContain('Station 02 // Inline Text Selection');
    expect(content).toContain('quantum-grade paradigm synergies');
    expect(content).toContain('Station 03 // Multi-Element Pins');
    expect(content).toContain('metric-card-2');
    expect(content).toContain('Station 04 // Complete the Loop');

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    expect(gitignoreContent).toContain('/lux-demo/');
  });

  it('preserves existing lux-demo/index.html without overwriting user progress', () => {
    const demoDir = path.join(testDir, 'lux-demo');
    const demoFile = path.join(demoDir, 'index.html');
    fs.mkdirSync(demoDir, { recursive: true });
    fs.writeFileSync(demoFile, '<html><body><h1>Custom User Edits</h1></body></html>', 'utf-8');

    // If already exists, do not overwrite
    if (!fs.existsSync(demoFile)) {
      fs.writeFileSync(demoFile, DEMO_HTML_TEMPLATE, 'utf-8');
    }

    const content = fs.readFileSync(demoFile, 'utf-8');
    expect(content).toContain('Custom User Edits');
    expect(content).not.toContain('HYPERFAST DEVLOPMENT ENGINE');
  });

  it('serves the demo page with overlay injected over HTTP', async () => {
    const demoDir = path.join(testDir, 'lux-demo');
    const demoFile = path.join(demoDir, 'index.html');
    fs.mkdirSync(demoDir, { recursive: true });
    fs.writeFileSync(demoFile, DEMO_HTML_TEMPLATE, 'utf-8');

    const server = new VisualEditServer({
      target: demoFile,
      port: 0,
      host: '127.0.0.1',
      rootDir: testDir,
    });

    const reviewUrl = await server.listen();
    expect(reviewUrl).toBeDefined();

    const res = await fetch(reviewUrl);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('Lux Interactive Playground');
    expect(html).toContain('<script type="module" src="/__visual_edit__/overlay.js"></script>');
    expect(html).toContain('HYPERFAST DEVLOPMENT ENGINE');
    expect(html).toContain('quantum-grade paradigm synergies');
    expect(html).toContain('metric-card-2');

    await server.close();
  });
});
