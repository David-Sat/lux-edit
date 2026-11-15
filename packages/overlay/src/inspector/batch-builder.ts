import {
  AgentReply,
  CommentAnnotation,
  ElementVariantSet,
  MutationRecord,
  ReviewMode,
  SessionStatus,
  VariantDecision,
  VisualEditBatch,
  VoiceReviewWalkthrough,
  computeBatchRevisionHash,
} from '@visual-edit/core';
import { resolveSourceLocation } from '../source-locator/index.js';
import { normalizeRoute } from './route-utils.js';

export interface BuildBatchInput {
  sessionId: string;
  currentRoute: string;
  pageMeta: { url: string; pathname: string; pageTitle: string };
  appId?: string;
  status: SessionStatus;
  reviewMode: ReviewMode;
  userPrompt: string;
  activeElement: HTMLElement | null;
  mutations: MutationRecord[];
  annotations: CommentAnnotation[];
  voiceReviews: VoiceReviewWalkthrough[];
  variantSets: ElementVariantSet[];
  variantDecisions: VariantDecision[];
  replies: AgentReply[];
}

/** Assembles a complete VisualEditBatch snapshot with deduplicated visited routes and revision hash. */
export function buildBatchSnapshot(input: BuildBatchInput): VisualEditBatch {
  const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
  const routeWithSearch = input.currentRoute.includes('?') ? input.currentRoute : `${input.currentRoute}${search}`;

  const primarySource = input.activeElement
    ? resolveSourceLocation(input.activeElement)
    : input.mutations[0]?.sourceLocation;

  const visitedByNorm = new Map<string, string>();
  const addVisited = (p?: string) => {
    if (!p) return;
    const norm = normalizeRoute(p);
    if (!visitedByNorm.has(norm)) {
      visitedByNorm.set(norm, p);
    }
  };

  addVisited(input.currentRoute);
  input.mutations.forEach((m) => addVisited(m.pathname));
  input.annotations.forEach((a) => {
    addVisited(a.pathname);
    a.targets?.forEach((t) => addVisited(t.pathname));
  });
  input.voiceReviews.forEach((v) => {
    addVisited(v.pathname);
    v.pins?.forEach((p) => addVisited(p.pathname));
  });

  const batch: VisualEditBatch = {
    id: input.sessionId,
    timestamp: Date.now(),
    route: routeWithSearch,
    url: input.pageMeta.url,
    pageTitle: input.pageMeta.pageTitle,
    pagesVisited: Array.from(visitedByNorm.values()),
    appId: input.appId,
    status: input.status,
    reviewMode: input.reviewMode,
    userPrompt: input.userPrompt,
    primarySource,
    mutations: input.mutations,
    annotations: input.annotations,
    voiceReviews: input.voiceReviews,
    variantSets: input.variantSets,
    variantDecisions: input.variantDecisions,
    replies: input.replies,
  };

  batch.revisionHash = computeBatchRevisionHash(batch);
  return batch;
}
