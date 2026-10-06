# Lux Principles

Core guidelines for designing Lux features, MCP tools, and agent workflows.

---

### 1. Single Entry Point (`/lux`)
Keep `/lux` as the primary entry point to avoid command sprawl. The agent should implicitly understand user intent and execute the review workflow without requiring specialized sub-commands.

### 2. Minimal, Single-Call Tooling
Deliver everything the agent needs in a single, context-efficient MCP call instead of multi-step back-and-forth roundtrips. Summaries should prioritize high-signal code diffs, exact coordinates, and concise snippets to conserve context tokens.

### 3. Automated Lifecycle
When the agent updates the codebase, the dev server's file watcher automatically marks the review resolved and refreshes the browser with a clean slate.

### 4. Modern Agent & MCP Standards
Build on modern Model Context Protocol (MCP) and agent plugin specifications to ensure zero-config compatibility across major AI coding tools.
