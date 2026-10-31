# Supported Agent Harnesses & Compatibility Specification

This document details the agent harnesses supported by `lux-edit`, their configuration paths, protocol discovery rules, and how upstream drift is monitored.

---

## Supported Harness Matrix

| Harness | Key | Scope | MCP Config Path | Skills Location | Discovery Indicator |
|---|---|---|---|---|---|
| **Google Antigravity** | `antigravity` | Global / Plugin | `~/.gemini/config/plugins/lux-edit/mcp_config.json` | `~/.gemini/config/plugins/lux-edit/skills/` | `~/.gemini` |
| **Claude Code** | `claude` | User / Global | `~/.claude.json` (`mcpServers`) | `~/.claude/skills/<name>/SKILL.md` | `~/.claude` or `~/.claude.json` |
| **Cursor** | `cursor` | Global | `~/.cursor/mcp.json` (`mcpServers`) | Workspace `.agents/` / `.cursorrules` | `~/.cursor` or `/Applications/Cursor.app` |
| **Windsurf** | `windsurf` | Global | `~/.codeium/windsurf/mcp_config.json` | Workspace `.agents/` | `~/.codeium/windsurf` |
| **Claude Desktop** | `desktop` | Global | OS AppData `claude_desktop_config.json` | N/A (MCP only) | OS Claude config or app bundle |
| **Cline** | `cline` | User (VS Code) | Code `globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` | Workspace `.agents/` | Global storage folder |
| **Roo Code** | `roo` | User (VS Code) | Code `globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json` | Workspace `.agents/` | Global storage folder |
| **Zed Editor** | `zed` | Global | `~/.config/zed/settings.json` (`context_servers`) | N/A (MCP only) | `~/.config/zed` or `/Applications/Zed.app` |
| **Continue.dev** | `continue` | User | `~/.continue/config.json` (`mcpServers`) | `~/.continue/prompts/` | `~/.continue` |
| **VS Code / Copilot** | `vscode` | User | `~/.vscode/mcp.json` (`mcpServers`) | Workspace `.agents/` | OS Code config or app bundle |

---

## Universal Project / Workspace Standard

When running `lux init` inside a project workspace (without `--global`), `lux` writes to the universal open standard:

1. **`.mcp.json` & `mcp.json`:** Universal Model Context Protocol configuration, recognized by Cursor, Claude Code, Windsurf, Zed, and VS Code.
2. **`skills/lux/SKILL.md` & `skills/lux-web/SKILL.md`:** Standard agent skills with YAML frontmatter.
3. **`.agents/skills/`:** Universal multi-agent standard directory.
4. **`.claude-plugin/`:** Official Claude Code project plugin format (`plugin.json` + `.mcp.json`).
5. **`plugin.json`:** Open Agent Plugin standard ([agent-plugins.org](https://agent-plugins.org)).

---

## How Upstream Drift is Prevented

1. **Declarative Harness Registry:**
   All harness detection, file paths, and installation strategies are centralized in `AGENT_HARNESSES` (`packages/cli/src/init.ts`). No agent-specific paths are hardcoded in procedural loops.
2. **Contract Invariant Tests:**
   Unit tests in `packages/cli/src/__tests__/init.test.ts` assert harness invariants (e.g. asserting Claude Code uses `~/.claude.json` and never `~/.claude/mcp.json`).
3. **CI Canary Automation:**
   `.github/workflows/canary.yml` runs daily against the latest published version of agent CLIs (e.g. `@anthropic-ai/claude-code`) to catch upstream configuration path changes before user bug reports.
4. **CLI Delegation with Fallback:**
   When an agent provides a management CLI (such as `claude mcp add`), `lux init` invokes the official CLI while retaining atomic JSON file fallbacks for offline, containerized, and sandbox environments.
