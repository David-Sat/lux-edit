import { describe, it, expect } from 'vitest';
import { computeTextDiff, computeStyleDiff, computeClassDiff, formatBatchSummary } from '../diff.js';
import { VisualEditBatch } from '../types.js';

describe('Diff Utilities', () => {
  it('computes text diffs properly', () => {
    const res = computeTextDiff('Hello World', 'Hello lux-edit', 'h1');
    expect(res).not.toBeNull();
    expect(res?.type).toBe('TEXT_EDIT');
    expect(res?.before).toBe('Hello World');
    expect(res?.after).toBe('Hello lux-edit');
  });

  it('computes style diffs and suggests tailwind classes', () => {
    const original = { padding: '8px', 'margin-bottom': '16px' };
    const current = { padding: '24px', 'margin-bottom': '32px' };
    const diffs = computeStyleDiff(original, current, '.hero-btn');

    expect(diffs).toHaveLength(2);
    const pDiff = diffs.find((d) => d.property === 'padding');
    expect(pDiff?.after).toBe('24px');
    expect(pDiff?.tailwindSuggestion).toBe('p-6');

    const mbDiff = diffs.find((d) => d.property === 'margin-bottom');
    expect(mbDiff?.after).toBe('32px');
    expect(mbDiff?.tailwindSuggestion).toBe('mb-8');
  });

  it('computes classList diffs properly', () => {
    const before = ['btn', 'btn-primary', 'shadow'];
    const after = ['btn', 'btn-secondary', 'rounded-full'];
    const diffs = computeClassDiff(before, after, 'button');

    expect(diffs).toHaveLength(1);
    expect(diffs[0].details?.added).toEqual(['btn-secondary', 'rounded-full']);
    expect(diffs[0].details?.removed).toEqual(['btn-primary', 'shadow']);
  });

  it('formats human and agent readable summary', () => {
    const batch: VisualEditBatch = {
      id: 'batch_test_1',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      userPrompt: 'Make the hero CTA punchier and larger',
      primarySource: {
        fileName: 'src/components/Hero.tsx',
        lineNumber: 42,
        componentName: 'Hero',
        selector: 'button.cta',
        tag: 'button',
      },
      mutations: [
        {
          id: 'm1',
          type: 'TEXT_EDIT',
          targetSelector: 'button.cta',
          before: 'Click here',
          after: 'Get Started Free',
        },
        {
          id: 'm2',
          type: 'STYLE_CHANGE',
          targetSelector: 'button.cta',
          property: 'padding',
          before: '8px',
          after: '16px',
          tailwindSuggestion: 'p-4',
        },
      ],
      annotations: [
        {
          id: 'ann1',
          timestamp: Date.now(),
          type: 'text',
          targetSelector: 'h1.title',
          selectedText: 'AI agent revolution',
          comment: 'Make this wording bolder',
        },
      ],
    };

    const summary = formatBatchSummary(batch);
    expect(summary).toContain('Visual Edit Batch: batch_test_1');
    expect(summary).toContain('src/components/Hero.tsx:42');
    expect(summary).toContain('Get Started Free');
    expect(summary).toContain('p-4');
    expect(summary).toContain('Comment on text selection');
    expect(summary).toContain('AI agent revolution');
    expect(summary).toContain('Make this wording bolder');
  });

  it('formats multi-element annotations properly in batch summary', () => {
    const batch: VisualEditBatch = {
      id: 'batch_multi_test',
      timestamp: Date.now(),
      route: '/',
      status: 'submitted',
      mutations: [],
      annotations: [
        {
          id: 'ann_multi',
          timestamp: Date.now(),
          type: 'multi',
          comment: 'Align these two boxes horizontally and match widths',
          targets: [
            {
              targetSelector: '#box-a',
              sourceLocation: {
                fileName: 'src/Diagram.tsx',
                lineNumber: 15,
                componentName: 'BoxA',
                selector: '#box-a',
                tag: 'div',
              },
              htmlSnippet: '<div id="box-a">Box A</div>',
            },
            {
              targetSelector: '#box-b',
              sourceLocation: {
                fileName: 'src/Diagram.tsx',
                lineNumber: 35,
                componentName: 'BoxB',
                selector: '#box-b',
                tag: 'div',
              },
              htmlSnippet: '<div id="box-b">Box B</div>',
            },
          ],
        },
      ],
    };

    const summary = formatBatchSummary(batch);
    expect(summary).toContain('Comment on 2 elements');
    expect(summary).toContain('src/Diagram.tsx:15');
    expect(summary).toContain('src/Diagram.tsx:35');
    expect(summary).toContain('Align these two boxes horizontally and match widths');
    expect(summary).toContain('Target 1 (`src/Diagram.tsx:15`): `<div id="box-a">Box A</div>`');
    expect(summary).toContain('Target 2 (`src/Diagram.tsx:35`): `<div id="box-b">Box B</div>`');
  });
});

