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

const MODIFIER_FLAG_ALIASES: Record<string, keyof Omit<ParsedHotkey, 'key'>> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
  win: 'meta',
};

const ARROW_SYMBOLS: Record<string, string> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
};

function normalizeSingleKeyToken(rawKey: string): string {
  if (rawKey === ' ') return 'space';
  const trimmed = rawKey.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed === ' ' || trimmed === 'spacebar' || trimmed === 'space') return 'space';
  if (trimmed === '+') return 'plus';
  return trimmed;
}

function tokenizeHotkeyString(raw: string): string[] {
  if (raw === ' ') return ['space'];
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

/** Parses a hotkey string into explicit modifier flags and normalized key token. */
export function parseHotkey(binding: string): ParsedHotkey | null {
  if (typeof binding !== 'string') return null;
  const tokens = tokenizeHotkeyString(binding);
  if (tokens.length === 0) return null;

  const parsed: ParsedHotkey = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: '',
  };

  for (const rawToken of tokens) {
    const lower = rawToken.trim().toLowerCase();
    if (!lower) continue;
    const modFlag = MODIFIER_FLAG_ALIASES[lower];
    if (modFlag) {
      parsed[modFlag] = true;
    } else {
      parsed.key = normalizeSingleKeyToken(rawToken);
    }
  }

  if (!parsed.key || RESERVED_KEY_TOKENS.has(parsed.key)) {
    return null;
  }

  return parsed;
}

function formatParsedHotkeyParts(
  parsed: ParsedHotkey,
  ctrlName: string,
  keyFormatter: (key: string) => string
): string {
  const parts: string[] = [];
  if (parsed.ctrl) parts.push(ctrlName);
  if (parsed.alt) parts.push(ctrlName === 'ctrl' ? 'alt' : 'Alt');
  if (parsed.shift) parts.push(ctrlName === 'ctrl' ? 'shift' : 'Shift');
  if (parsed.meta) parts.push(ctrlName === 'ctrl' ? 'meta' : 'Meta');
  parts.push(keyFormatter(parsed.key));
  return parts.join('+');
}

/**
 * Canonicalizes a hotkey string (e.g. "Alt + Shift + E" -> "alt+shift+e", " " -> "space").
 * Returns `''` for empty, modifier-only, or reserved navigation keys.
 */
export function normalizeHotkey(raw: string): string {
  const parsed = parseHotkey(raw);
  return parsed ? formatParsedHotkeyParts(parsed, 'ctrl', (k) => k) : '';
}

/** Returns true when a hotkey includes a command/chord modifier safe to use while typing in inputs. */
export function hasCommandModifierInHotkey(binding: string): boolean {
  const parsed = parseHotkey(binding);
  return Boolean(parsed && (parsed.ctrl || parsed.alt || parsed.meta));
}

/** Formats a binding for display in tooltips and keycaps (e.g. "alt+shift+e" -> "Alt+Shift+E"). */
export function formatHotkeyLabel(binding: string): string {
  const parsed = parseHotkey(binding);
  if (!parsed) return 'Off';
  return formatParsedHotkeyParts(parsed, 'Ctrl', (key) => {
    if (key === 'space') return 'Space';
    if (key === 'plus') return '+';
    if (ARROW_SYMBOLS[key]) return ARROW_SYMBOLS[key];
    if (key.length === 1) return key.toUpperCase();
    return key.charAt(0).toUpperCase() + key.slice(1);
  });
}

/** Formats a binding for the WAI-ARIA `aria-keyshortcuts` attribute. */
export function formatAriaKeyShortcuts(binding: string): string | undefined {
  const parsed = parseHotkey(binding);
  if (!parsed) return undefined;
  return formatParsedHotkeyParts(parsed, 'Control', (key) => {
    if (key === 'space') return 'Space';
    if (key === 'plus') return '+';
    return key.length === 1 ? key.toUpperCase() : key;
  });
}

function resolveKeyboardEventKeyToken(e: KeyboardEvent): string {
  const code = e.code || '';
  const rawKey = e.key || '';

  // macOS Option/Alt produces dead keys or non-ASCII symbols (e.g. Alt+E -> "´"/"Dead");
  // recover the physical Latin letter or digit from `e.code` when present.
  const isNonPrintableOrNonAscii =
    rawKey.length === 1 && (rawKey.charCodeAt(0) < 32 || rawKey.charCodeAt(0) > 126);
  if (e.altKey || rawKey === 'Dead' || rawKey === 'Unidentified' || isNonPrintableOrNonAscii) {
    const keyMatch = /^Key([A-Z])$/.exec(code);
    if (keyMatch) return keyMatch[1].toLowerCase();
    const digitMatch = /^Digit([0-9])$/.exec(code);
    if (digitMatch) return digitMatch[1];
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

  const normalized = normalizeHotkey(
    [
      e.ctrlKey ? 'ctrl' : '',
      e.altKey ? 'alt' : '',
      e.shiftKey ? 'shift' : '',
      e.metaKey ? 'meta' : '',
      keyToken,
    ]
      .filter(Boolean)
      .join('+')
  );
  return normalized || null;
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

  return resolveKeyboardEventKeyToken(e) === parsed.key;
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
