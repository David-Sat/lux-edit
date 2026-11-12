export const DEFAULT_PORT = 4320;

export const DEFAULT_SERVER_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

export const SERVER_METADATA_DIR = '.visual-edit';
export const SERVER_METADATA_FILE = 'server.json';

export const API_ROUTES = {
  PENDING: '/__visual_edit__/api/pending',
  EDITS: '/__visual_edit__/api/edits',
  SESSIONS: '/__visual_edit__/api/sessions',
  HOOKS: '/__visual_edit__/api/hooks',
  CAPTURE: '/__visual_edit__/api/capture',
  VARIANTS: '/__visual_edit__/api/variants',
  STATUS: '/__visual_edit__/api/status',
  OVERLAY_JS: '/__visual_edit__/overlay.js',
  VERSION: '/__visual_edit__/api/version',
  WS: '/__visual_edit__/ws',
} as const;

export const STORAGE_KEYS = {
  DRAFT_PREFIX: 'lux_draft_',
  DOCK_POSITION: 'lux_dock_position',
  COMPOSER_DRAFT: 'lux_composer_draft',
  REVIEW_MODE: 'lux_review_mode',
  VERIFY_TARGETS: 'lux_verify_targets',
  LEGACY_ACTIVE_DRAFT: 'visual_edit_active_draft',
  LEGACY_APP_DRAFT_PREFIX: 'visual_edit_draft_',
} as const;
