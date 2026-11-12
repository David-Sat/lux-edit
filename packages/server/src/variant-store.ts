import fs from 'node:fs';
import path from 'node:path';
import {
  ElementVariantSet,
  VariantDecision,
  VisualEditBatch,
  ReviewMode,
} from '@visual-edit/core';

export interface VariantStoreContext {
  getPendingReview: () => VisualEditBatch | null;
  getSession: (id: string) => VisualEditBatch | undefined;
  saveBatch: (session: VisualEditBatch, options?: { forceSubmit?: boolean }) => void;
  notify: (type: string, id: string, payload: any) => void;
  nextCursor: () => number;
  getReviewMode: () => ReviewMode;
  onVariantProposed?: (variantSet: ElementVariantSet) => void;
}

export class VariantStore {
  private variantsPath: string;
  private variantSets = new Map<string, ElementVariantSet>();
  private ctx: VariantStoreContext;

  constructor(variantsPath: string, ctx: VariantStoreContext) {
    this.variantsPath = variantsPath;
    this.ctx = ctx;
    this.loadVariantsFromDisk();
  }

  public loadVariantsFromDisk(): void {
    try {
      if (!fs.existsSync(this.variantsPath)) {
        return;
      }
      const raw = fs.readFileSync(this.variantsPath, 'utf-8').trim();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.variantSets.clear();
        for (const item of parsed) {
          if (item && item.id) {
            this.variantSets.set(item.id, item);
          }
        }
        // Ensure only the latest pending set per targetSelector stays pending
        const latestPending = new Map<string, string>();
        for (const item of parsed) {
          if (item && item.id && item.status === 'pending' && item.targetSelector) {
            const prevId = latestPending.get(item.targetSelector);
            if (prevId) {
              const prev = this.variantSets.get(prevId);
              if (prev) prev.status = 'superseded';
            }
            latestPending.set(item.targetSelector, item.id);
          }
        }
      }
    } catch {
      // Intentionally silent on read error
    }
  }

  public saveVariantsToDisk(): void {
    try {
      const dataDir = path.dirname(this.variantsPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const data = Array.from(this.variantSets.values()).slice(-30);
      const tempPath = `${this.variantsPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      fs.renameSync(tempPath, this.variantsPath);
    } catch {
      // Intentionally silent
    }
  }

  public proposeVariants(input: {
    targetSelector: string;
    label?: string;
    expectedHash?: string;
    variants: Array<{
      id?: string;
      name: string;
      rationale: string;
      styles?: Record<string, string>;
      classes?: { add?: string[]; remove?: string[] };
      html?: string;
      text?: string;
    }>;
  }): ElementVariantSet {
    this.loadVariantsFromDisk();
    const setId = `varset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Check if current active session has a targetHash for this selector
    let originalTargetHash: string | undefined;
    let isStale = false;
    let staleReason: string | undefined;

    const pending = this.ctx.getPendingReview();
    if (pending) {
      const matchingMut = pending.mutations?.find((m) => m.targetSelector === input.targetSelector);
      const matchingAnn = pending.annotations?.find((a) => a.targetSelector === input.targetSelector);
      originalTargetHash = matchingMut?.targetHash || matchingAnn?.targetHash || pending.revisionHash;
      if (input.expectedHash && originalTargetHash && input.expectedHash !== originalTargetHash) {
        isStale = true;
        staleReason = `Target hash mismatch: expected ${input.expectedHash}, current is ${originalTargetHash}`;
      }
    }

    const variantSet: ElementVariantSet = {
      id: setId,
      targetSelector: input.targetSelector,
      label: input.label || `Variants for ${input.targetSelector}`,
      createdAt: Date.now(),
      expectedHash: input.expectedHash,
      originalTargetHash,
      status: isStale ? 'stale' : 'pending',
      staleReason,
      variants: input.variants.map((v: any, idx) => {
        let styles: Record<string, string> | undefined = v.styles;
        if (!styles && Array.isArray(v.styleMutations)) {
          styles = {};
          for (const m of v.styleMutations) {
            if (m.property && m.value !== undefined) {
              styles[m.property] = String(m.value);
            }
          }
        }
        return {
          id: v.id || `var_${idx + 1}_${Date.now().toString(36)}`,
          name: v.name,
          rationale: v.rationale || v.description || '',
          styles,
          classes: v.classes,
          html: v.html,
          text: v.text,
        };
      }),
    };

    if (!isStale) {
      // Supersede any existing pending variant sets for the same targetSelector
      for (const [existingId, existingSet] of this.variantSets.entries()) {
        if (existingSet.targetSelector === input.targetSelector && existingSet.status === 'pending') {
          existingSet.status = 'superseded';
          this.variantSets.set(existingId, existingSet);
          this.ctx.notify('SUPERSEDE_VARIANTS', existingId, existingSet);
        }
      }
      this.variantSets.set(setId, variantSet);
      this.saveVariantsToDisk();
      if (this.ctx.onVariantProposed) {
        this.ctx.onVariantProposed(variantSet);
      }
      this.ctx.notify('PROPOSE_VARIANTS', setId, variantSet);
    }
    return variantSet;
  }

  public dismissVariantSet(setId: string): boolean {
    this.loadVariantsFromDisk();
    const set = this.variantSets.get(setId);
    if (!set) return false;
    set.status = 'superseded';
    this.saveVariantsToDisk();
    this.ctx.notify('SUPERSEDE_VARIANTS', setId, set);
    return true;
  }

  public getVariantSets(targetSelector?: string): ElementVariantSet[] {
    this.loadVariantsFromDisk();
    const all = Array.from(this.variantSets.values());
    if (targetSelector) {
      return all.filter((s) => s.targetSelector === targetSelector);
    }
    return all;
  }

  public recordVariantDecision(input: {
    setId: string;
    selectedVariantId: string;
    userNote?: string;
    targetHash?: string;
    sessionId?: string;
  }): VariantDecision | null {
    this.loadVariantsFromDisk();
    const set = this.variantSets.get(input.setId);
    if (!set) return null;

    const chosen = set.variants.find((v) => v.id === input.selectedVariantId);
    if (!chosen) return null;

    set.selectedVariantId = chosen.id;
    set.status = 'decided';
    this.saveVariantsToDisk();

    const cursor = this.ctx.nextCursor();
    const decision: VariantDecision = {
      id: `vdec_${Date.now().toString(36)}`,
      setId: set.id,
      targetSelector: set.targetSelector,
      label: set.label,
      selectedVariantId: chosen.id,
      variantName: chosen.name,
      rationale: chosen.rationale,
      variant: chosen,
      userNote: input.userNote,
      targetHash: input.targetHash || set.originalTargetHash,
      timestamp: Date.now(),
      cursor,
    };

    const reviewMode = this.ctx.getReviewMode();
    let targetSession = input.sessionId ? this.ctx.getSession(input.sessionId) : this.ctx.getPendingReview();
    if (!targetSession) {
      const id = input.sessionId || `session_${Date.now().toString(36)}`;
      targetSession = {
        id,
        timestamp: Date.now(),
        route: '/',
        status: reviewMode === 'live' ? 'submitted' : 'draft',
        reviewMode,
        mutations: [],
        annotations: [],
        voiceReviews: [],
        variantDecisions: [decision],
      };
    } else {
      if (!targetSession.variantDecisions) targetSession.variantDecisions = [];
      targetSession.variantDecisions = targetSession.variantDecisions.filter((d) => d.setId !== set.id);
      targetSession.variantDecisions.push(decision);
    }

    this.ctx.saveBatch(targetSession, { forceSubmit: reviewMode === 'live' });
    this.ctx.notify('DECIDE_VARIANT', targetSession.id, { set, decision });
    return decision;
  }

  public revertVariantDecision(setId: string, sessionId?: string): boolean {
    this.loadVariantsFromDisk();
    const set = this.variantSets.get(setId);
    if (!set) return false;

    set.selectedVariantId = undefined;
    set.status = 'pending';
    this.saveVariantsToDisk();

    const reviewMode = this.ctx.getReviewMode();
    const targetSession = sessionId ? this.ctx.getSession(sessionId) : this.ctx.getPendingReview();
    if (targetSession && targetSession.variantDecisions) {
      targetSession.variantDecisions = targetSession.variantDecisions.filter((d) => d.setId !== setId);
      this.ctx.saveBatch(targetSession, { forceSubmit: reviewMode === 'live' });
    }

    this.ctx.notify('PROPOSE_VARIANTS', set.id, set);
    this.ctx.notify('SYNC_VARIANTS', 'global', this.getVariantSets());
    return true;
  }

  public deleteVariantSet(setId: string, sessionId?: string): boolean {
    this.loadVariantsFromDisk();
    const set = this.variantSets.get(setId);
    if (set) {
      set.status = 'superseded';
      set.selectedVariantId = undefined;
      this.saveVariantsToDisk();
      this.ctx.notify('SUPERSEDE_VARIANTS', setId, set);
    }

    const reviewMode = this.ctx.getReviewMode();
    const targetSession = sessionId ? this.ctx.getSession(sessionId) : this.ctx.getPendingReview();
    if (targetSession && targetSession.variantDecisions) {
      targetSession.variantDecisions = targetSession.variantDecisions.filter((d) => d.setId !== setId);
      this.ctx.saveBatch(targetSession, { forceSubmit: reviewMode === 'live' });
    }

    this.ctx.notify('SYNC_VARIANTS', 'global', this.getVariantSets());
    return true;
  }
}
