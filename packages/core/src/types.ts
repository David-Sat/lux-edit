export type FrameworkType = 'react' | 'vue' | 'svelte' | 'html' | 'unknown';

export type ReviewMode = 'live' | 'batch';

export type ViewportPreset = 'desktop' | 'tablet' | 'mobile';

export interface SourceLocation {
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
  componentName?: string;
  framework?: FrameworkType;
  selector: string;
  xpath?: string;
  tag: string;
  id?: string;
  classes?: string[];
  htmlSnippet?: string;
}

export type MutationType =
  | 'TEXT_EDIT'
  | 'STYLE_CHANGE'
  | 'CLASS_CHANGE'
  | 'DOM_INSERT'
  | 'DOM_REMOVE'
  | 'DOM_REORDER'
  | 'THEME_CHANGE';

export interface MutationRecord {
  id: string;
  type: MutationType;
  targetSelector: string;
  sourceLocation?: SourceLocation;
  htmlSnippet?: string;
  url?: string;
  pathname?: string;
  pageTitle?: string;
  property?: string;
  before: string;
  after: string;
  tailwindSuggestion?: string;
  details?: Record<string, any>;
  targetHash?: string;
  cursor?: number;
}

export interface AnnotationTarget {
  targetSelector: string;
  sourceLocation?: SourceLocation;
  bounds?: { x: number; y: number; width: number; height: number };
  htmlSnippet?: string;
  pathname?: string;
  targetHash?: string;
}

export interface VoiceSection {
  id: string;
  order: number;
  targets: AnnotationTarget[];
  transcript: string;
  interimTranscript?: string;
  timestampMs: number;
  startTimeMs?: number;
  endTimeMs?: number;
  targetHash?: string;
  cursor?: number;
}

export interface CommentAnnotation {
  id: string;
  timestamp: number;
  type: 'element' | 'area' | 'text' | 'multi' | 'voice' | 'screenshot';
  targets?: AnnotationTarget[];
  targetSelector?: string;
  sourceLocation?: SourceLocation;
  htmlSnippet?: string;
  url?: string;
  pathname?: string;
  pageTitle?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  selectedText?: string;
  comment: string;
  screenshot?: string;
  voiceSections?: VoiceSection[];
  targetHash?: string;
  cursor?: number;
}

export interface DockPosition {
  side: 'left' | 'right';
  verticalAnchor: 'top' | 'bottom';
  offsetY: number;
}

export type SessionStatus =
  | 'draft'
  | 'submitted'
  | 'in_progress'
  | 'implemented'
  | 'resolved'
  | 'rejected';

export interface AgentReply {
  id: string;
  timestamp: number;
  agentId: string;
  message: string;
}

export interface AgentClaim {
  agentId: string;
  harness?: string;
  leasedAt: number;
  expiresAt: number;
}

export interface VoiceTargetPin {
  id: string;
  order: number;
  targetSelector: string;
  sourceLocation?: SourceLocation;
  htmlSnippet?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  timestampMs?: number;
  pathname?: string;
  targetHash?: string;
}

export interface VoiceReviewWalkthrough {
  id: string;
  timestamp: number;
  durationMs?: number;
  transcript: string;
  annotatedTranscript: string;
  pins: VoiceTargetPin[];
  sections?: VoiceSection[];
  url?: string;
  pathname?: string;
  pageTitle?: string;
  cursor?: number;
}

export interface ElementVariant {
  id: string;
  name: string;
  rationale: string;
  styles?: Record<string, string>;
  classes?: {
    add?: string[];
    remove?: string[];
  };
  html?: string;
  text?: string;
}

export interface ElementVariantSet {
  id: string;
  targetSelector: string;
  label: string;
  createdAt: number;
  expectedHash?: string;
  originalTargetHash?: string;
  variants: ElementVariant[];
  selectedVariantId?: string | null;
  status: 'pending' | 'decided' | 'stale' | 'superseded';
  staleReason?: string;
}

export interface VariantDecision {
  id: string;
  setId: string;
  targetSelector: string;
  label?: string;
  selectedVariantId: string;
  variantName: string;
  rationale?: string;
  variant: ElementVariant;
  userNote?: string;
  targetHash?: string;
  timestamp: number;
  cursor?: number;
}

export interface OverflowIssue {
  selector: string;
  reason: 'horizontal-overflow' | 'vertical-clip' | 'zero-bounds' | 'offscreen';
  scrollWidth?: number;
  clientWidth?: number;
  scrollHeight?: number;
  clientHeight?: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface LayoutDiagnostics {
  bounds: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number; devicePixelRatio: number; preset?: ViewportPreset };
  domHash: string;
  computedStyles?: Record<string, string>;
  overflowIssues: OverflowIssue[];
  brokenImages: string[];
  textSnippet?: string;
  elementCount?: number;
}

export interface VisualCaptureRequest {
  requestId?: string;
  selector?: string;
  viewport?: ViewportPreset;
  resolution?: 'draft' | 'full';
  includeOverlay?: boolean;
}

export interface VisualCaptureResponse {
  requestId: string;
  success: boolean;
  error?: string;
  imageBase64?: string;
  mimeType?: 'image/png';
  width?: number;
  height?: number;
  url?: string;
  pageTitle?: string;
  selector?: string;
  diagnostics?: LayoutDiagnostics;
  capturedAt: number;
}

export interface HookLeaseStatus {
  connected: boolean;
  harness?: string;
  sessionId?: string;
  agentState: 'idle' | 'listening' | 'implementing';
  seenCursor: number;
  latestCursor: number;
  expiresAt?: number;
  reviewMode?: ReviewMode;
  waiterConnected?: boolean;
  endedByUser?: boolean;
}

export interface VerificationTarget {
  selector: string;
  bounds?: { x: number; y: number; width: number; height: number };
  label?: string;
  beforeHash?: string;
  timestamp: number;
}

export interface VisualEditBatch {
  id: string;
  timestamp: number;
  route: string;
  url?: string;
  pageTitle?: string;
  pagesVisited?: string[];
  appId?: string;
  status: SessionStatus;
  reviewMode?: ReviewMode;
  revisionHash?: string;
  latestCursor?: number;
  stale?: boolean;
  staleReason?: string;
  userPrompt?: string;
  primarySource?: SourceLocation;
  mutations: MutationRecord[];
  annotations?: CommentAnnotation[];
  voiceReviews?: VoiceReviewWalkthrough[];
  variantDecisions?: VariantDecision[];
  variantSets?: ElementVariantSet[];
  beforeSnippet?: string;
  afterSnippet?: string;
  claim?: AgentClaim;
  replies?: AgentReply[];
  lastFetchedAt?: number;
}

export interface SessionSummary {
  id: string;
  timestamp: number;
  route: string;
  status: SessionStatus;
  reviewMode?: ReviewMode;
  revisionHash?: string;
  latestCursor?: number;
  mutationCount: number;
  annotationCount?: number;
  voiceReviewCount?: number;
  variantDecisionCount?: number;
  userPrompt?: string;
  primaryTarget?: string;
  hasClaim: boolean;
  claimByCurrentSession?: boolean;
}

export interface WebSocketMessage {
  type:
    | 'SYNC_SESSION'
    | 'SUBMIT_BATCH'
    | 'STATUS_CHANGE'
    | 'AGENT_REPLY'
    | 'AGENT_STATUS'
    | 'SET_REVIEW_MODE'
    | 'CAPTURE_REQUEST'
    | 'CAPTURE_RESPONSE'
    | 'PROPOSE_VARIANTS'
    | 'SYNC_VARIANTS'
    | 'SUPERSEDE_VARIANTS'
    | 'DECIDE_VARIANT'
    | 'REVERT_VARIANT_DECISION'
    | 'DELETE_VARIANT_DECISION'
    | 'DISMISS_VARIANT'
    | 'END_LIVE_REVIEW'
    | 'RELOAD_PAGE'
    | 'PING'
    | 'PONG';
  payload: any;
  sessionId?: string;
}

export interface LuxServerMetadata {
  pid: number;
  port: number;
  url: string;
  target: string;
  appId: string;
  startTime: number;
  rootDir: string;
}
