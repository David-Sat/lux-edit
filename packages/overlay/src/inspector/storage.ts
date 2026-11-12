import {
  CommentAnnotation,
  DockPosition,
  MutationRecord,
  ReviewMode,
  SessionStatus,
  STORAGE_KEYS,
  VariantDecision,
  VerificationTarget,
  VisualEditBatch,
  VoiceReviewWalkthrough,
} from '@visual-edit/core';

export interface LoadedPersistedState {
  reviewMode?: ReviewMode;
  sessionId?: string;
  sessionStatus?: SessionStatus;
  mutations?: MutationRecord[];
  annotations?: CommentAnnotation[];
  voiceReviews?: VoiceReviewWalkthrough[];
  variantDecisions?: VariantDecision[];
  userPrompt?: string;
  dockPosition?: DockPosition;
  commentDraftText?: string;
}

export function getScopedDraftKey(): string {
  const appId = typeof window !== 'undefined' ? (window as any).__LUX_APP_ID__ : undefined;
  return `${STORAGE_KEYS.DRAFT_PREFIX}${appId || 'default'}`;
}

export function loadPersistedState(): LoadedPersistedState {
  const result: LoadedPersistedState = {};

  try {
    if (typeof localStorage !== 'undefined') {
      const savedMode = localStorage.getItem(STORAGE_KEYS.REVIEW_MODE);
      if (savedMode === 'live' || savedMode === 'batch') {
        result.reviewMode = savedMode;
      }
    }
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      const key = getScopedDraftKey();
      let saved = localStorage.getItem(key);
      if (!saved) {
        const appId = typeof window !== 'undefined' ? (window as any).__LUX_APP_ID__ : undefined;
        if (appId) {
          saved = localStorage.getItem(`${STORAGE_KEYS.LEGACY_APP_DRAFT_PREFIX}${appId}`);
        }
        if (!saved) {
          saved = localStorage.getItem(STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
        }
        if (saved) {
          try {
            if (appId) localStorage.removeItem(`${STORAGE_KEYS.LEGACY_APP_DRAFT_PREFIX}${appId}`);
            localStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
          } catch {}
        }
      }

      if (saved) {
        const data = JSON.parse(saved);
        if (data.status !== 'implemented' && data.status !== 'resolved') {
          result.sessionId = data.id;
          result.sessionStatus = data.status || 'draft';
          result.mutations = data.mutations || [];
          result.annotations = data.annotations || [];
          result.voiceReviews = data.voiceReviews || [];
          result.variantDecisions = data.variantDecisions || [];
          result.userPrompt = data.userPrompt || '';

          // Reconcile voice reviews & annotations to clean up any orphaned transcripts/pins
          const voiceAnnIds = new Set(result.annotations!.filter((a) => a.type === 'voice').map((a) => a.id));
          const voiceReviewIds = new Set(result.voiceReviews!.map((v) => v.id));
          result.voiceReviews = result.voiceReviews!.filter((v) => voiceAnnIds.has(v.id));
          result.annotations = result.annotations!.filter((a) => a.type !== 'voice' || voiceReviewIds.has(a.id));
        }
      }
    }
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      const savedPos = localStorage.getItem(STORAGE_KEYS.DOCK_POSITION);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (
          (parsed.side === 'left' || parsed.side === 'right') &&
          (parsed.verticalAnchor === 'top' || parsed.verticalAnchor === 'bottom') &&
          typeof parsed.offsetY === 'number'
        ) {
          result.dockPosition = {
            side: parsed.side,
            verticalAnchor: parsed.verticalAnchor,
            offsetY: Math.max(10, parsed.offsetY),
          };
        }
      }
    }
  } catch {}

  try {
    if (typeof sessionStorage !== 'undefined') {
      const savedDraft = sessionStorage.getItem(STORAGE_KEYS.COMPOSER_DRAFT);
      if (savedDraft) {
        result.commentDraftText = savedDraft;
      }
    }
  } catch {}

  return result;
}

export function savePersistedDraft(batch: VisualEditBatch, hasContent: boolean, sessionStatus: SessionStatus): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = getScopedDraftKey();
    if (
      sessionStatus === 'implemented' ||
      sessionStatus === 'resolved' ||
      (!hasContent && sessionStatus === 'draft')
    ) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(batch));
    }
  } catch {}
}

export function clearPersistedDraft(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(getScopedDraftKey());
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
  } catch {}
}

export function saveReviewMode(mode: ReviewMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.REVIEW_MODE, mode);
    }
  } catch {}
}

export function saveDockPosition(pos: DockPosition): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DOCK_POSITION, JSON.stringify(pos));
    }
  } catch {}
}

export function saveComposerDraft(text: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (text) {
        sessionStorage.setItem(STORAGE_KEYS.COMPOSER_DRAFT, text);
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.COMPOSER_DRAFT);
      }
    }
  } catch {}
}

export function persistVerificationTargets(targets: VerificationTarget[]): void {
  try {
    if (typeof sessionStorage !== 'undefined' && Array.isArray(targets) && targets.length > 0) {
      sessionStorage.setItem(STORAGE_KEYS.VERIFY_TARGETS, JSON.stringify(targets));
    }
  } catch {}
}

export function clearVerificationTargets(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEYS.VERIFY_TARGETS);
    }
  } catch {}
}

export function consumeVerificationTargets(): VerificationTarget[] | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEYS.VERIFY_TARGETS);
      if (raw) {
        sessionStorage.removeItem(STORAGE_KEYS.VERIFY_TARGETS);
        const targets = JSON.parse(raw) as VerificationTarget[];
        if (Array.isArray(targets) && targets.length > 0) {
          return targets;
        }
      }
    }
  } catch {}
  return null;
}
