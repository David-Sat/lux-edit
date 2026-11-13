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
  [key: string]: unknown;
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
    const normalizedHarness = harness === 'claude' ? 'claude' : harness;
    const events: Array<{ event: HookEventName; timeout: number; matcher?: string }> = [
      { event: 'PostToolUse', timeout: 10, matcher: '.*lux.*' },
      { event: 'Stop', timeout: 600 },
      { event: 'SessionEnd', timeout: 3 },
    ];
    if (harness === 'codex') {
      events.push({ event: 'Interrupt', timeout: 3 });
    }

    for (const { event, timeout, matcher } of events) {
      const existingList = Array.isArray(hooksMap[event]) ? (hooksMap[event] as unknown[]) : [];
      const { cleaned } = stripGeneratedHooksFromList(existingList);

      const newEntry: HookGroupEntry = {
        hooks: [
          {
            type: 'command',
            command: `${cmd} hook event --harness ${normalizedHarness} --event ${event}`,
            timeout,
          },
        ],
      };
      if (matcher) {
        newEntry.matcher = matcher;
      }
      cleaned.push(newEntry);
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
