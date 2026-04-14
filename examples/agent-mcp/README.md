# Agent integration — copy-paste examples

Use these files to wire **Cursor**, **Claude Desktop**, or **curl** to Loyal Spark without reading the whole repo.

| File | Purpose |
|------|---------|
| [cursor-mcp.json](./cursor-mcp.json) | Merge into project `.cursor/mcp.json` (replace `lsk_YOUR_API_KEY`) |
| [claude_desktop_config.fragment.json](./claude_desktop_config.fragment.json) | Merge `mcpServers` into Claude Desktop config |
| [first-request.sh](./first-request.sh) | Bash: list programs after you export `LOYAL_SPARK_API_KEY` |

Get an API key: [loyalspark.online/merchant](https://loyalspark.online/merchant) → **AI Agents** → register agent → copy `lsk_...`.

Human-facing onboarding: [https://loyalspark.online/for-agents](https://loyalspark.online/for-agents)
