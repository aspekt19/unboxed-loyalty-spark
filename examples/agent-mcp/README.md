# Agent integration — copy-paste examples

Use these files to wire **Cursor**, **Claude Desktop**, or **curl** to Loyal Spark without reading the whole repo.

| File | Purpose |
|------|---------|
| [cursor-mcp.json](./cursor-mcp.json) | Merge into project or `~/.cursor/mcp.json` — uses `${env:LOYAL_SPARK_API_KEY}` (no key in file) |
| [claude_desktop_config.fragment.json](./claude_desktop_config.fragment.json) | Merge `mcpServers` into Claude Desktop config |
| [first-request.sh](./first-request.sh) | Bash: list programs after you export `LOYAL_SPARK_API_KEY` |

Get an API key: [loyalspark.online/merchant](https://loyalspark.online/merchant) → sign in (header **Sign In**; **Profile** only after session) → **AI Agents** → register agent → copy `lsk_...`. Portal UX: [docs/development/PORTALS_AND_TEAM.md](../../docs/development/PORTALS_AND_TEAM.md).

**Cursor:** set the variable where Cursor can see it (per [Cursor MCP docs](https://cursor.com/docs/mcp), remote servers resolve `${env:…}` from your environment). Examples: export in `~/.zprofile` then **fully quit Cursor (Cmd+Q) and start it from Terminal** once (`open -a Cursor`) so the app inherits the shell session; or define the same variable in your OS user environment if you use a GUI-only launch flow.

Human-facing onboarding: [https://loyalspark.online/for-agents](https://loyalspark.online/for-agents)
