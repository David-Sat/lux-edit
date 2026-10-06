export const DEFAULT_PORT = 4320;

export const DEFAULT_SERVER_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

export const SERVER_METADATA_DIR = '.visual-edit';
export const SERVER_METADATA_FILE = 'server.json';

export const API_ROUTES = {
  PENDING: '/__visual_edit__/api/pending',
  EDITS: '/__visual_edit__/api/edits',
  SESSIONS: '/__visual_edit__/api/sessions',
  OVERLAY_JS: '/__visual_edit__/overlay.js',
  WS: '/__visual_edit__/ws',
} as const;

export const STORAGE_KEYS = {
  DRAFT_PREFIX: 'lux_draft_',
  LEGACY_ACTIVE_DRAFT: 'visual_edit_active_draft',
  LEGACY_APP_DRAFT_PREFIX: 'visual_edit_draft_',
} as const;
