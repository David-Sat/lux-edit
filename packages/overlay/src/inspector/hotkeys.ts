export type OverlayHotkeyAction = 'edit' | 'comment' | 'voice' | 'screenshot' | 'drawer';

export type OverlayHotkeys = Record<OverlayHotkeyAction, string>;

export interface HotkeyActionMeta {
  action: OverlayHotkeyAction;
  label: string;
  description: string;
}

export interface ParsedHotkey {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

export const DEFAULT_OVERLAY_HOTKEYS: OverlayHotkeys = {
  edit: 'v',
  comment: 'c',
  voice: 'r',
  screenshot: 's',
  drawer: 'd',
};

export const HOTKEY_ACTION_LIST: HotkeyActionMeta[] = [
  {
    action: 'edit',
    label: 'Visual Edit',
    description: 'Toggle element inspect & style/text editor',
  },
  {
    action: 'comment',
    label: 'Comment Pin',
    description: 'Toggle element & text comment pin mode',
  },
  {
    action: 'voice',
    label: 'Voice Review',
    description: 'Start or stop voice walkthrough recording',
  },
  {
    action: 'screenshot',
    label: 'Screenshot Snap',
    description: 'Capture an element screenshot into a comment',
  },
  {
    action: 'drawer',
    label: 'Review Drawer',
    description: 'Open or close the Review Changes drawer',
  },
];

const RESERVED_KEY_TOKENS = new Set([
  '',
  'tab',
  'enter',
  'return',
  'escape',
  'esc',
  'backspace',
  'delete',
  'del',
  'shift',
  'control',
  'ctrl',
  'alt',
  'option',
  'opt',
  'altgraph',
  'meta',
  'command',
  'cmd',
  'super',
  'win',
  'os',
  'capslock',
  'numlock',
  'scrolllock',
  'dead',
  'unidentified',
  'process',
]);

function normalizeSingleKeyToken(rawKey: string): string {
  if (rawKey === ' ') return 'space';
  const trimmed = rawKey.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed === ' ' || trimmed === 'spacebar' || trimmed === 'space') return 'space';
  if (trimmed === '+') return 'plus';
  return trimmed;
}

/**
 * Splits a hotkey string on '+' while preserving literal '+' key tokens (e.g. "Ctrl++" or "+").
 */
function tokenizeHotkeyString(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed === '+') return ['plus'];

  const tokens: string[] = [];
  let current = '';

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === '+') {
      if (current.trim().length > 0) {
        tokens.push(current.trim());
        current = '';
      } else if (i === trimmed.length - 1) {
        tokens.push('plus');
      }
    } else {
      current += ch;
    }
  }

  if (current.trim().length > 0) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Canonicalizes a hotkey string (e.g. "Alt + Shift + E" -> "alt+shift+e", " " -> "space").
 * Returns `''` for empty, modifier-only, or reserved navigation keys.
 */
export function normalizeHotkey(raw: string): string {
  if (typeof raw !== 'string') return '';
  if (raw === ' ') return 'space';

  const tokens = tokenizeHotkeyString(raw);
  if (tokens.length === 0) return '';

  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  let key = '';

  for (const rawToken of tokens) {
    const lower = rawToken.trim().toLowerCase();
    if (!lower) continue;

    if (lower === 'ctrl' || lower === 'control') {
      ctrl = true;
    } else if (lower === 'alt' || lower === 'option' || lower === 'opt') {
      alt = true;
    } else if (lower === 'shift') {
      shift = true;
    } else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super' || lower === 'win') {
      meta = true;
    } else {
      key = normalizeSingleKeyToken(rawToken);
    }
  }

  if (!key || RESERVED_KEY_TOKENS.has(key)) {
    return '';
  }

  const ordered: string[] = [];
  if (ctrl) ordered.push('ctrl');
  if (alt) ordered.push('alt');
  if (shift) ordered.push('shift');
  if (meta) ordered.push('meta');
  ordered.push(key);
  return ordered.join('+');
}

/** Parses a hotkey string into explicit modifier flags and normalized key token. */
export function parseHotkey(binding: string): ParsedHotkey | null {
  const normalized = normalizeHotkey(binding);
  if (!normalized) return null;

  const parts = normalized.split('+');
  const key = parts[parts.length - 1];
  if (!key) return null;

  return {
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta'),
    key,
  };
}

/** Returns true when a hotkey binding includes any modifier key (`ctrl`, `alt`, `shift`, `meta`). */
export function hasModifierInHotkey(binding: string): boolean {
  const parsed = parseHotkey(binding);
  return Boolean(parsed && (parsed.ctrl || parsed.alt || parsed.shift || parsed.meta));
}

/** Returns true when a hotkey includes a command/chord modifier safe to use while typing in inputs. */
export function hasCommandModifierInHotkey(binding: string): boolean {
  const parsed = parseHotkey(binding);
  return Boolean(parsed && (parsed.ctrl || parsed.alt || parsed.meta));
}

const ARROW_SYMBOLS: Record<string, string> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
};

/** Formats a binding for display in tooltips and keycaps (e.g. "alt+shift+e" -> "Alt+Shift+E"). */
export function formatHotkeyLabel(binding: string): string {
  const parsed = parseHotkey(binding);
  if (!parsed) return 'Off';

  const parts: string[] = [];
  if (parsed.ctrl) parts.push('Ctrl');
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  if (parsed.meta) parts.push('Meta');

  let keyLabel: string;
  if (parsed.key === 'space') {
    keyLabel = 'Space';
  } else if (parsed.key === 'plus') {
    keyLabel = '+';
  } else if (ARROW_SYMBOLS[parsed.key]) {
    keyLabel = ARROW_SYMBOLS[parsed.key];
  } else if (parsed.key.length === 1) {
    keyLabel = parsed.key.toUpperCase();
  } else {
    keyLabel = parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1);
  }

  parts.push(keyLabel);
  return parts.join('+');
}

/** Formats a binding for the WAI-ARIA `aria-keyshortcuts` attribute. */
export function formatAriaKeyShortcuts(binding: string): string | undefined {
  const parsed = parseHotkey(binding);
  if (!parsed) return undefined;

  const parts: string[] = [];
  if (parsed.ctrl) parts.push('Control');
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  if (parsed.meta) parts.push('Meta');

  const keyToken =
    parsed.key === 'space'
      ? 'Space'
      : parsed.key === 'plus'
        ? '+'
        : parsed.key.length === 1
          ? parsed.key.toUpperCase()
          : parsed.key;

  parts.push(keyToken);
  return parts.join('+');
}

function resolveKeyboardEventKeyToken(e: KeyboardEvent): string {
  const code = e.code || '';
  const rawKey = e.key || '';

  // macOS Option/Alt produces dead keys or non-ASCII symbols (e.g. Alt+E -> "´"/"Dead");
  // recover the physical Latin letter or digit from `e.code` when present.
  const isNonPrintableOrNonAscii =
    rawKey.length === 1 && (rawKey.charCodeAt(0) < 32 || rawKey.charCodeAt(0) > 126);
  const isMangledAltOrDead =
    e.altKey ||
    rawKey === 'Dead' ||
    rawKey === 'Unidentified' ||
    isNonPrintableOrNonAscii;

  if (isMangledAltOrDead) {
    const keyMatch = /^Key([A-Z])$/.exec(code);
    if (keyMatch) {
      return keyMatch[1].toLowerCase();
    }
    const digitMatch = /^Digit([0-9])$/.exec(code);
    if (digitMatch) {
      return digitMatch[1];
    }
  }

  return normalizeSingleKeyToken(rawKey);
}

/**
 * Converts a live `KeyboardEvent` into a normalized hotkey string for shortcut capture.
 * Returns `null` for bare modifiers and reserved navigation/edit keys (`Tab`, `Enter`, `Escape`, `Backspace`, `Delete`).
 */
export function eventToHotkeyBinding(e: KeyboardEvent): string | null {
  const keyToken = resolveKeyboardEventKeyToken(e);
  if (!keyToken || RESERVED_KEY_TOKENS.has(keyToken)) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');
  parts.push(keyToken);

  return normalizeHotkey(parts.join('+')) || null;
}

/** Returns true if `e` exactly matches the modifiers and key of `binding`. */
export function matchesHotkeyEvent(e: KeyboardEvent, binding: string): boolean {
  const parsed = parseHotkey(binding);
  if (!parsed) return false;

  if (
    Boolean(e.ctrlKey) !== parsed.ctrl ||
    Boolean(e.altKey) !== parsed.alt ||
    Boolean(e.shiftKey) !== parsed.shift ||
    Boolean(e.metaKey) !== parsed.meta
  ) {
    return false;
  }

  const eventKey = resolveKeyboardEventKeyToken(e);
  return eventKey === parsed.key;
}

/** Validates and merges a partial hotkey map with `DEFAULT_OVERLAY_HOTKEYS`, preventing duplicate bindings. */
export function mergeHotkeys(partial?: Partial<Record<string, unknown>> | null): OverlayHotkeys {
  const result: OverlayHotkeys = { ...DEFAULT_OVERLAY_HOTKEYS };
  if (!partial || typeof partial !== 'object') {
    return result;
  }

  const actions = Object.keys(DEFAULT_OVERLAY_HOTKEYS) as OverlayHotkeyAction[];
  const explicitOverrides = new Map<OverlayHotkeyAction, string>();

  for (const action of actions) {
    if (!(action in partial)) continue;
    const rawVal = partial[action];
    if (rawVal === '') {
      explicitOverrides.set(action, '');
    } else if (typeof rawVal === 'string') {
      const normalized = normalizeHotkey(rawVal);
      if (normalized) {
        explicitOverrides.set(action, normalized);
      }
    }
  }

  for (const [action, binding] of explicitOverrides) {
    if (binding) {
      for (const otherAction of actions) {
        if (otherAction !== action && result[otherAction] === binding && !explicitOverrides.has(otherAction)) {
          result[otherAction] = '';
        }
      }
    }
    result[action] = binding;
  }

  return result;
}
