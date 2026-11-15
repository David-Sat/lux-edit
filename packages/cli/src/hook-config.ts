import fs from 'node:fs';
import path from 'node:path';

export type HookHarness = 'antigravity' | 'claude-code' | 'codex' | 'claude' | 'auto';
export type HookEventName = 'PostToolUse' | 'PreInvocation' | 'Stop' | 'SessionEnd' | 'Interrupt' | 'Wait';

export function getAntigravityHooksContent(autoUpdate: boolean = false) {
  const cmd = autoUpdate ? 'npx -y lux-edit@latest' : 'lux-edit';
  return {
    'lux-live-review': {
      PreInvocation: [
        {
          type: 'command',
          command: `${cmd} hook event --harness antigravity --event PreInvocation`,
          timeout: 5,
        },
      ],
      PostToolUse: [
        {
          matcher: '.*lux.*',
          hooks: [
            {
              type: 'command',
              command: `${cmd} hook event --harness antigravity --event PostToolUse`,
              timeout: 10,
            },
          ],
        },
      ],
      Stop: [
        {
          type: 'command',
          command: `${cmd} hook event --harness antigravity --event Stop`,
          timeout: 600,
        },
      ],
    },
  };
}

function isGeneratedHookCommand(cmd: unknown): boolean {
  if (typeof cmd !== 'string') return false;
  return cmd.includes('lux-edit') && cmd.includes('hook event');
}

function writeJsonFileAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tempPath, filePath);
}

interface HookCommandEntry {
  type?: string;
  command?: unknown;
  timeout?: number;
  /** Claude Code only: permission-rule filter evaluated before the hook process is spawned. */
  if?: string;
  [key: string]: unknown;
}

/**
 * PostToolUse must fire both for lux MCP tool calls and for shell commands that launch `lux`
 * (e.g. `lux ./index.html --port 4320`), because either one binds this agent session to the
 * review lease that the Stop hook later holds on. The precise "is this really a lux command"
 * check lives in `normalizeHookPayload`; these filters only keep the hook from running needlessly.
 *
 * - Claude Code: `matcher` is an exact name or unanchored regex on `tool_name`, and the handler-level
 *   `if` (permission-rule syntax) filters on the Bash command so unrelated shell calls never spawn
 *   the hook. Versions without `if` support simply run it for every Bash call, which stays correct.
 * - Codex: `matcher` is a regex on `tool_name` with no input filter, so Bash is matched by name.
 */
export const CLAUDE_MCP_TOOL_MATCHER = '.*lux.*';
export const CLAUDE_BASH_TOOL_MATCHER = 'Bash';
export const CLAUDE_BASH_LUX_IF = 'Bash(*lux*)';
export const CODEX_POST_TOOL_USE_MATCHER = '^Bash$|lux';

interface PostToolUseGroupSpec {
  matcher: string;
  if?: string;
}

function getPostToolUseGroups(harness: 'claude-code' | 'codex' | 'claude'): PostToolUseGroupSpec[] {
  if (harness === 'codex') {
    return [{ matcher: CODEX_POST_TOOL_USE_MATCHER }];
  }
  return [
    { matcher: CLAUDE_MCP_TOOL_MATCHER },
    { matcher: CLAUDE_BASH_TOOL_MATCHER, if: CLAUDE_BASH_LUX_IF },
  ];
}

interface HookGroupEntry {
  matcher?: string;
  hooks?: HookCommandEntry[];
  [key: string]: unknown;
}

function isHookGroupEntry(val: unknown): val is HookGroupEntry {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

/** Strips previously generated lux-edit hook entries while preserving all user-defined hooks. */
function stripGeneratedHooksFromList(list: unknown[]): { cleaned: unknown[]; modified: boolean } {
  let modified = false;
  const cleaned = list
    .map((group) => {
      if (!isHookGroupEntry(group) || !Array.isArray(group.hooks)) return group;
      const kept = group.hooks.filter((hook) => !isGeneratedHookCommand(hook?.command));
      if (kept.length !== group.hooks.length) {
        modified = true;
      }
      if (kept.length === 0) return null;
      return { ...group, hooks: kept };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  return { cleaned, modified };
}

/**
 * Merges Antigravity, Claude Code, or Codex hook definitions into ~/.claude/settings.json,
 * .claude/settings.local.json, .codex/hooks.json, or ~/.gemini/antigravity/hooks.json
 * while preserving existing user settings.
 */
export function mergeHarnessHooksConfig(
  filePath: string,
  harness: 'antigravity' | 'claude-code' | 'codex' | 'claude',
  dryRun: boolean = false,
  autoUpdate: boolean = false
): boolean {
  try {
    let data: Record<string, unknown> = {};
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      if (raw) {
        data = JSON.parse(raw) as Record<string, unknown>;
      }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    if (harness === 'antigravity') {
      Object.assign(data, getAntigravityHooksContent(autoUpdate));
      if (!dryRun) {
        writeJsonFileAtomic(filePath, data);
      }
      return true;
    }

    if (!data.hooks || typeof data.hooks !== 'object' || Array.isArray(data.hooks)) {
      data.hooks = {};
    }
    const hooksMap = data.hooks as Record<string, unknown>;

    const pkg = autoUpdate ? 'lux-edit@latest' : 'lux-edit';
    const cmd = autoUpdate ? `npx -y ${pkg}` : 'lux-edit';
    const events: Array<{ event: HookEventName; timeout: number; groups?: PostToolUseGroupSpec[] }> = [
      { event: 'PostToolUse', timeout: 10, groups: getPostToolUseGroups(harness) },
      { event: 'Stop', timeout: 600 },
      { event: 'SessionEnd', timeout: 3 },
    ];
    if (harness === 'codex') {
      events.push({ event: 'Interrupt', timeout: 3 });
    }

    for (const { event, timeout, groups } of events) {
      const existingList = Array.isArray(hooksMap[event]) ? (hooksMap[event] as unknown[]) : [];
      const { cleaned } = stripGeneratedHooksFromList(existingList);
      const command = `${cmd} hook event --harness ${harness} --event ${event}`;

      for (const group of groups ?? [undefined]) {
        const handler: HookCommandEntry = { type: 'command', command, timeout };
        if (group?.if) {
          handler.if = group.if;
        }
        const newEntry: HookGroupEntry = { hooks: [handler] };
        if (group?.matcher) {
          newEntry.matcher = group.matcher;
        }
        cleaned.push(newEntry);
      }
      hooksMap[event] = cleaned;
    }

    if (!dryRun) {
      writeJsonFileAtomic(filePath, data);
    }
    return true;
  } catch {
    return false;
  }
}

export function removeHarnessHooksConfig(
  filePath: string,
  harnessOrDryRun?: string | boolean,
  dryRunOpt: boolean = false
): boolean {
  try {
    const dryRun = typeof harnessOrDryRun === 'boolean' ? harnessOrDryRun : dryRunOpt;
    if (!fs.existsSync(filePath)) return false;
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      return false;
    }

    let modified = false;

    if (data['lux-live-review']) {
      delete data['lux-live-review'];
      modified = true;
    }

    if (data.hooks && typeof data.hooks === 'object') {
      for (const event of Object.keys(data.hooks)) {
        const list = data.hooks[event];
        if (!Array.isArray(list)) continue;
        const { cleaned, modified: listModified } = stripGeneratedHooksFromList(list);
        if (listModified) {
          modified = true;
        }
        if (cleaned.length === 0) {
          delete data.hooks[event];
        } else {
          data.hooks[event] = cleaned;
        }
      }

      if (Object.keys(data.hooks).length === 0) {
        delete data.hooks;
      }
    }

    if (modified && !dryRun) {
      writeJsonFileAtomic(filePath, data);
    }
    return modified;
  } catch {
    return false;
  }
}
