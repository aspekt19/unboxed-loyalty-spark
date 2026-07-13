# Install — Per Surface

Loyal Spark ships two MCP servers (merchant `loyalty-mcp` and recipient `recipient-loyalty-mcp`). Pick the one matching the API key prefix you have.

Replace `lsk_YOUR_API_KEY` with `rwk_YOUR_API_KEY` for the recipient server.

## Claude Desktop / Claude.ai

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://api.loyalspark.online/loyalty-mcp",
      "headers": { "x-api-key": "lsk_YOUR_API_KEY" }
    }
  }
}
```

Restart Claude. The 36 merchant tools register on first session.

## ChatGPT (Developer Mode)

Settings → Connectors → Create → New App:
- **Name:** `Loyal Spark`
- **MCP Server URL:** `https://api.loyalspark.online/loyalty-mcp`
- **Authentication:** Custom header `x-api-key: lsk_YOUR_API_KEY`

## Cursor / VS Code

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://api.loyalspark.online/loyalty-mcp",
      "headers": { "x-api-key": "${env:LOYAL_SPARK_API_KEY}" }
    }
  }
}
```

## Claude Code

```bash
claude mcp add --transport http --scope user loyal-spark https://api.loyalspark.online/loyalty-mcp \
  --header "x-api-key: lsk_YOUR_API_KEY"
```

## Codex

```bash
codex mcp add loyal-spark --url https://api.loyalspark.online/loyalty-mcp \
  --header "x-api-key=lsk_YOUR_API_KEY"
```

## Hermes

`~/.hermes/config.yaml`:

```yaml
mcp_servers:
  loyal-spark:
    url: https://api.loyalspark.online/loyalty-mcp
    headers:
      x-api-key: lsk_YOUR_API_KEY
```

Then `/reload-mcp` in an active session.

## Skill bundle (via skills.sh CLI)

Once published at `loyalspark/skills`:

```bash
npx skills add loyalspark/skills --skill loyal-spark
```

Installs to `~/.{claude,cursor,codex,hermes}/skills/loyal-spark/` depending on the `-a` target.

## Getting a key

- Humans: https://loyalspark.online/merchant → AI Agents → Register.
- Autonomous (SIWE): see [auth.md](auth.md).
