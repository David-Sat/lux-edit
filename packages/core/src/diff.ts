import { MutationRecord, SourceLocation, VisualEditBatch } from './types.js';
import { mapStyleToTailwind } from './tailwind-mapper.js';

let mutationCounter = 0;
function genMutationId(): string {
  return `mut_${Date.now().toString(36)}_${(++mutationCounter).toString(36)}`;
}

export function computeTextDiff(
  originalText: string,
  currentText: string,
  targetSelector: string,
  sourceLocation?: SourceLocation,
  htmlSnippet?: string
): MutationRecord | null {
  const before = originalText.trim();
  const after = currentText.trim();
  if (before === after) return null;

  return {
    id: genMutationId(),
    type: 'TEXT_EDIT',
    targetSelector,
    sourceLocation,
    htmlSnippet: htmlSnippet || sourceLocation?.htmlSnippet,
    before,
    after,
    details: {
      charDelta: after.length - before.length,
    },
  };
}

export function computeStyleDiff(
  originalStyles: Record<string, string>,
  currentStyles: Record<string, string>,
  targetSelector: string,
  sourceLocation?: SourceLocation,
  htmlSnippet?: string
): MutationRecord[] {
  const mutations: MutationRecord[] = [];
  const allProps = new Set([...Object.keys(originalStyles), ...Object.keys(currentStyles)]);

  for (const prop of allProps) {
    const before = (originalStyles[prop] || '').trim();
    const after = (currentStyles[prop] || '').trim();

    if (before !== after && after !== '') {
      const tailwindSuggestion = mapStyleToTailwind(prop, after);
      mutations.push({
        id: genMutationId(),
        type: 'STYLE_CHANGE',
        targetSelector,
        sourceLocation,
        htmlSnippet: htmlSnippet || sourceLocation?.htmlSnippet,
        property: prop,
        before,
        after,
        tailwindSuggestion,
      });
    }
  }

  return mutations;
}

export function computeClassDiff(
  originalClasses: string[],
  currentClasses: string[],
  targetSelector: string,
  sourceLocation?: SourceLocation,
  htmlSnippet?: string
): MutationRecord[] {
  const beforeSet = new Set(originalClasses.filter(Boolean));
  const afterSet = new Set(currentClasses.filter(Boolean));

  const added = [...afterSet].filter((c) => !beforeSet.has(c));
  const removed = [...beforeSet].filter((c) => !afterSet.has(c));

  const mutations: MutationRecord[] = [];

  if (added.length > 0 || removed.length > 0) {
    mutations.push({
      id: genMutationId(),
      type: 'CLASS_CHANGE',
      targetSelector,
      sourceLocation,
      htmlSnippet: htmlSnippet || sourceLocation?.htmlSnippet,
      before: originalClasses.join(' '),
      after: currentClasses.join(' '),
      details: {
        added,
        removed,
      },
    });
  }

  return mutations;
}

export function formatBatchSummary(batch: VisualEditBatch): string {
  const lines: string[] = [];
  lines.push(`### Visual Edit Batch: ${batch.id}`);
  lines.push(`**Route**: \`${batch.route}\`${batch.pageTitle ? ` ("${batch.pageTitle}")` : ''}`);
  if (batch.url) {
    lines.push(`**URL**: \`${batch.url}\``);
  }
  if (batch.pagesVisited && batch.pagesVisited.length > 1) {
    lines.push(`**Pages Edited**: ${batch.pagesVisited.map((p) => `\`${p}\``).join(', ')}`);
  }

  if (batch.userPrompt) {
    lines.push(`**User Intent**: "${batch.userPrompt}"`);
  }

  if (batch.primarySource) {
    const s = batch.primarySource;
    const fileRef = s.fileName ? `${s.fileName}${s.lineNumber ? `:${s.lineNumber}` : ''}` : s.selector;
    const compRef = s.componentName ? ` (<${s.componentName}>)` : '';
    lines.push(`**Primary Target**: \`${fileRef}\`${compRef}`);
  }

  if (batch.mutations.length > 0) {
    lines.push(`\n**Visual Modifications (${batch.mutations.length} edits)**:`);

    for (const m of batch.mutations) {
      const loc = m.sourceLocation?.fileName
        ? `\`${m.sourceLocation.fileName}:${m.sourceLocation.lineNumber || 1}\``
        : m.sourceLocation?.componentName
        ? `\`<${m.sourceLocation.componentName}>\``
        : `\`${m.targetSelector}\``;

      const pageTag = m.pathname && m.pathname !== batch.route ? ` [Page: \`${m.pathname}\`]` : '';
      const snippet = m.htmlSnippet || m.sourceLocation?.htmlSnippet;

      switch (m.type) {
        case 'TEXT_EDIT':
          lines.push(`- **Text Change** on ${loc}${pageTag}:`);
          if (snippet) lines.push(`  - Element: \`${snippet}\``);
          lines.push(`  - Before: \`"${m.before}"\``);
          lines.push(`  - After:  \`"${m.after}"\``);
          break;
        case 'STYLE_CHANGE': {
          const tw = m.tailwindSuggestion ? ` *(Tailwind suggestion: \`${m.tailwindSuggestion}\`)*` : '';
          lines.push(`- **Style** \`${m.property}\` on ${loc}${pageTag}: \`${m.before}\` ➔ \`${m.after}\`${tw}`);
          if (snippet) lines.push(`  - Element: \`${snippet}\``);
          break;
        }
        case 'CLASS_CHANGE':
          lines.push(`- **Classes** on ${loc}:`);
          if (snippet) lines.push(`  - Element: \`${snippet}\``);
          if (m.details?.added?.length) lines.push(`  - Added: \`${m.details.added.join(', ')}\``);
          if (m.details?.removed?.length) lines.push(`  - Removed: \`${m.details.removed.join(', ')}\``);
          break;
        case 'DOM_INSERT':
          lines.push(`- **Insert Element** after ${loc}: \`${m.after}\``);
          break;
        case 'DOM_REMOVE':
          lines.push(`- **Remove Element** on ${loc}: \`${m.before}\``);
          break;
        case 'DOM_REORDER':
          lines.push(`- **Reorder Sibling** on ${loc}: Moved from index ${m.before} to index ${m.after}`);
          break;
      }
    }
  }

  if (batch.annotations && batch.annotations.length > 0) {
    lines.push(`\n**Comments & Annotations (${batch.annotations.length} items)**:`);
    for (const a of batch.annotations) {
      const loc = a.sourceLocation?.fileName
        ? `\`${a.sourceLocation.fileName}:${a.sourceLocation.lineNumber || 1}\``
        : a.sourceLocation?.componentName
        ? `\`<${a.sourceLocation.componentName}>\``
        : a.targetSelector ? `\`${a.targetSelector}\`` : '`Area`';

      const snippet = a.htmlSnippet || a.sourceLocation?.htmlSnippet;

      lines.push(`- **Comment** on ${loc}: "${a.comment}"`);
      if (snippet) {
        lines.push(`  - Element: \`${snippet}\``);
      }
    }
  }

  return lines.join('\n');
}
