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

interface LuxAppWindow extends Window {
  __LUX_APP_ID__?: string;
}

function getLuxAppId(): string | undefined {
  return typeof window !== 'undefined' ? (window as LuxAppWindow).__LUX_APP_ID__ : undefined;
}

function safeGetStorage(area: 'local' | 'session', key: string): string | null {
  try {
    const store = area === 'local'
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    return store ? store.getItem(key) : null;
  } catch (err) {
    console.debug(`[lux] Failed to read ${area}Storage key "${key}":`, err);
    return null;
  }
}

function safeSetStorage(area: 'local' | 'session', key: string, value: string): void {
  try {
    const store = area === 'local'
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    store?.setItem(key, value);
  } catch (err) {
    console.debug(`[lux] Failed to write ${area}Storage key "${key}":`, err);
  }
}

function safeRemoveStorage(area: 'local' | 'session', key: string): void {
  try {
    const store = area === 'local'
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    store?.removeItem(key);
  } catch (err) {
    console.debug(`[lux] Failed to remove ${area}Storage key "${key}":`, err);
  }
}

export function getScopedDraftKey(): string {
  return `${STORAGE_KEYS.DRAFT_PREFIX}${getLuxAppId() || 'default'}`;
}

export function loadPersistedState(): LoadedPersistedState {
  const result: LoadedPersistedState = {};

  const savedMode = safeGetStorage('local', STORAGE_KEYS.REVIEW_MODE);
  if (savedMode === 'live' || savedMode === 'batch') {
    result.reviewMode = savedMode;
  }

  try {
    const key = getScopedDraftKey();
    let saved = safeGetStorage('local', key);
    if (!saved) {
      const appId = getLuxAppId();
      if (appId) {
        saved = safeGetStorage('local', `${STORAGE_KEYS.LEGACY_APP_DRAFT_PREFIX}${appId}`);
      }
      if (!saved) {
        saved = safeGetStorage('local', STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
      }
      if (saved) {
        if (appId) safeRemoveStorage('local', `${STORAGE_KEYS.LEGACY_APP_DRAFT_PREFIX}${appId}`);
        safeRemoveStorage('local', STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
      }
    }

    if (saved) {
      const data = JSON.parse(saved) as Partial<VisualEditBatch>;
      if (data.status !== 'implemented' && data.status !== 'resolved') {
        result.sessionId = data.id;
        result.sessionStatus = data.status || 'draft';
        result.mutations = data.mutations || [];
        result.annotations = data.annotations || [];
        result.voiceReviews = data.voiceReviews || [];
        result.variantDecisions = data.variantDecisions || [];
        result.userPrompt = data.userPrompt || '';

        // Reconcile voice reviews & annotations to clean up any orphaned transcripts/pins
        const voiceAnnIds = new Set(result.annotations.filter((a) => a.type === 'voice').map((a) => a.id));
        const voiceReviewIds = new Set(result.voiceReviews.map((v) => v.id));
        result.voiceReviews = result.voiceReviews.filter((v) => voiceAnnIds.has(v.id));
        result.annotations = result.annotations.filter((a) => a.type !== 'voice' || voiceReviewIds.has(a.id));
      }
    }
  } catch (err) {
    console.debug('[lux] Failed to parse persisted draft state:', err);
  }

  try {
    const savedPos = safeGetStorage('local', STORAGE_KEYS.DOCK_POSITION);
    if (savedPos) {
      const parsed = JSON.parse(savedPos) as Partial<DockPosition>;
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
  } catch (err) {
    console.debug('[lux] Failed to parse persisted dock position:', err);
  }

  const savedDraft = safeGetStorage('session', STORAGE_KEYS.COMPOSER_DRAFT);
  if (savedDraft) {
    result.commentDraftText = savedDraft;
  }

  return result;
}

export function savePersistedDraft(batch: VisualEditBatch, hasContent: boolean, sessionStatus: SessionStatus): void {
  const key = getScopedDraftKey();
  if (
    sessionStatus === 'implemented' ||
    sessionStatus === 'resolved' ||
    (!hasContent && sessionStatus === 'draft')
  ) {
    safeRemoveStorage('local', key);
  } else {
    safeSetStorage('local', key, JSON.stringify(batch));
  }
}

export function clearPersistedDraft(): void {
  safeRemoveStorage('local', getScopedDraftKey());
  safeRemoveStorage('local', STORAGE_KEYS.LEGACY_ACTIVE_DRAFT);
}

export function saveReviewMode(mode: ReviewMode): void {
  safeSetStorage('local', STORAGE_KEYS.REVIEW_MODE, mode);
}

export function saveDockPosition(pos: DockPosition): void {
  safeSetStorage('local', STORAGE_KEYS.DOCK_POSITION, JSON.stringify(pos));
}

export function saveComposerDraft(text: string): void {
  if (text) {
    safeSetStorage('session', STORAGE_KEYS.COMPOSER_DRAFT, text);
  } else {
    safeRemoveStorage('session', STORAGE_KEYS.COMPOSER_DRAFT);
  }
}

export function persistVerificationTargets(targets: VerificationTarget[]): void {
  if (Array.isArray(targets) && targets.length > 0) {
    safeSetStorage('session', STORAGE_KEYS.VERIFY_TARGETS, JSON.stringify(targets));
  }
}

export function clearVerificationTargets(): void {
  safeRemoveStorage('session', STORAGE_KEYS.VERIFY_TARGETS);
}

export function consumeVerificationTargets(): VerificationTarget[] | null {
  try {
    const raw = safeGetStorage('session', STORAGE_KEYS.VERIFY_TARGETS);
    if (raw) {
      safeRemoveStorage('session', STORAGE_KEYS.VERIFY_TARGETS);
      const targets = JSON.parse(raw) as VerificationTarget[];
      if (Array.isArray(targets) && targets.length > 0) {
        return targets;
      }
    }
  } catch (err) {
    console.debug('[lux] Failed to parse persisted verification targets:', err);
  }
  return null;
}
