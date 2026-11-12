import type { VisualEditBatch, SourceLocation } from './types.js';

/**
 * Fast, deterministic, isomorphic 64-bit FNV-1a hash (runs in Browser and Node without node:crypto).
 * Returns a 16-character hex digest prefixed with `h_`.
 */
export function fnv1aHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `h_${hex1}${hex2}`;
}

export interface TargetHashInput {
  selector: string;
  tag?: string;
  id?: string;
  classes?: string[];
  text?: string;
  htmlSnippet?: string;
  styles?: Record<string, string>;
  sourceLocation?: SourceLocation;
}

/**
 * Computes a deterministic content and style hash for a target DOM element.
 * Used for stale-check guards (`expectedHash`) and post-reload verification.
 */
export function computeTargetHash(input: TargetHashInput): string {
  const normalizedClasses = (input.classes || input.sourceLocation?.classes || [])
    .map((c) => c.trim())
    .filter(Boolean)
    .sort()
    .join(' ');

  const sortedStyles = input.styles
    ? Object.keys(input.styles)
        .sort()
        .map((k) => `${k}:${(input.styles![k] || '').trim()}`)
        .join(';')
    : '';

  const canonical = JSON.stringify({
    s: input.selector || input.sourceLocation?.selector || '',
    t: (input.tag || input.sourceLocation?.tag || '').toLowerCase(),
    id: input.id || input.sourceLocation?.id || '',
    c: normalizedClasses,
    txt: (input.text || '').trim().slice(0, 500),
    html: (input.htmlSnippet || input.sourceLocation?.htmlSnippet || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    st: sortedStyles,
  });

  return fnv1aHash(canonical);
}

/**
 * Computes a deterministic revision hash for an entire VisualEditBatch.
 * Changes whenever any mutation, annotation, voice walkthrough, or variant decision changes.
 */
export function computeBatchRevisionHash(batch: Partial<VisualEditBatch>): string {
  const canonical = JSON.stringify({
    id: batch.id || '',
    route: batch.route || '',
    prompt: (batch.userPrompt || '').trim(),
    mutations: (batch.mutations || []).map((m) => ({
      t: m.type,
      s: m.targetSelector,
      p: m.property || '',
      b: m.before,
      a: m.after,
      th: m.targetHash || '',
    })),
    annotations: (batch.annotations || []).map((a) => ({
      t: a.type,
      s: a.targetSelector || '',
      c: a.comment,
      th: a.targetHash || '',
      sections: (a.voiceSections || []).map((sec) => ({
        tr: sec.transcript,
        tg: sec.targets.map((tg) => tg.targetSelector),
      })),
    })),
    voice: (batch.voiceReviews || []).map((v) => ({
      tr: v.annotatedTranscript || v.transcript,
      sec: (v.sections || []).map((s) => ({
        tr: s.transcript,
        tg: s.targets.map((t) => t.targetSelector),
      })),
    })),
    decisions: (batch.variantDecisions || []).map((d) => ({
      setId: d.setId,
      varId: d.selectedVariantId,
      note: d.userNote || '',
    })),
  });

  return fnv1aHash(canonical);
}
