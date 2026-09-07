# Privacy Policy for lux-edit

**Effective Date:** September 7, 2026  
**Last Updated:** September 7, 2026  

`lux-edit` ("lux", "we", "our") is an open-source visual editing and review tool for web applications and AI coding agents. We respect your privacy and believe developer tools should operate transparently with zero unexpected data collection.

---

## 1. Zero Telemetry & No Tracking

`lux-edit` does not collect, track, store, or transmit any personal data, usage metrics, or telemetry. 
* There are **no analytics services** or tracking pixels bundled with lux.
* There is **no crash reporting** sent to external servers.
* We do not monitor how often you use lux, what commands you run, or what files you edit.

---

## 2. 100% Local Execution

* **Local-First Architecture:** The lux server runs exclusively on your local machine (`127.0.0.1` / `localhost`) as a local proxy or static server.
* **No Remote Cloud Backends:** No network requests are made to any remote cloud servers operated by lux or third parties.
* **Local MCP stdio:** Communication between lux and your AI coding agents (Claude Code, Cursor, Antigravity, Windsurf, etc.) takes place entirely on your device over standard input/output (`stdio`) via the Model Context Protocol (MCP).

---

## 3. Local Data Storage & Control

All visual annotations, comment pins, text selections, and style diffs you create are saved strictly on your local filesystem inside the active project directory:

```text
your-project/
  └── .visual-edit/
        └── sessions/
```

You maintain complete ownership and control over this data at all times. You can inspect, modify, or permanently delete the `.visual-edit/` directory whenever you choose.

---

## 4. AI Agent Integrations

When you invoke `/lux` or call lux MCP tools, lux provides your pending local review comments and diffs to your local AI coding agent harness. How your AI coding agent processes that context is governed by your own configuration and the privacy policy of the respective AI provider (e.g., Anthropic, OpenAI, Google). `lux-edit` itself never directly transmits data to any AI model APIs.

---

## 5. Open Source Transparency

The complete source code for `lux-edit` is publicly auditable on GitHub:  
[https://github.com/David-Sat/lux-edit](https://github.com/David-Sat/lux-edit)

---

## 6. Contact

If you have any questions about this Privacy Policy or lux-edit's privacy practices, please open an issue on GitHub:  
[https://github.com/David-Sat/lux-edit/issues](https://github.com/David-Sat/lux-edit/issues)
