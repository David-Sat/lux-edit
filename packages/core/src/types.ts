export type FrameworkType = 'react' | 'vue' | 'svelte' | 'html' | 'unknown';

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
}

export interface CommentAnnotation {
  id: string;
  timestamp: number;
  type: 'element' | 'area';
  targetSelector?: string;
  sourceLocation?: SourceLocation;
  htmlSnippet?: string;
  url?: string;
  pathname?: string;
  pageTitle?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  comment: string;
  screenshot?: string;
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
  leasedAt: number;
  expiresAt: number;
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
  userPrompt?: string;
  primarySource?: SourceLocation;
  mutations: MutationRecord[];
  annotations?: CommentAnnotation[];
  beforeSnippet?: string;
  afterSnippet?: string;
  claim?: AgentClaim;
  replies?: AgentReply[];
}

export interface SessionSummary {
  id: string;
  timestamp: number;
  route: string;
  status: SessionStatus;
  mutationCount: number;
  annotationCount?: number;
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
    | 'RELOAD_PAGE'
    | 'PING'
    | 'PONG';
  payload: any;
  sessionId?: string;
}
