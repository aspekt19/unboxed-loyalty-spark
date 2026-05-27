# Distribution Guide — Loyal Spark Skill for Base MCP / Anthropic / ChatGPT / Vercel Skills

This is the operational checklist for shipping the `loyal-spark` agent skill bundle (`skills/loyal-spark/`) to every distribution surface that matters.

## TL;DR

The `base/skills` repository is **currently closed to external PRs** ("contributions are limited to the Base core team", see [base/skills CONTRIBUTING.md](https://github.com/base/skills/blob/master/CONTRIBUTING.md)). So we cannot just open a PR adding `skills/loyal-spark/` there. The path forward is a **four-pronged distribution**:

1. Publish our own `loyalspark/skills` GitHub repo (CLI installable: `npx skills add loyalspark/skills --skill loyal-spark`).
2. Upload `loyal-spark.zip` to **Anthropic Claude Skills** (claude.ai → Customize → Skills).
3. Upload the same zip to **ChatGPT Skills** (Settings → Skills, Business/Enterprise/Edu plans).
4. Open **outreach to Base** with the plugin file (`skills/loyal-spark/plugins/loyal-spark.md`) so a future native `plugins/loyal-spark.md` ships inside `base/skills` once the repo opens up.

---

## 0. Source of truth in this repo

Already prepared under [`skills/loyal-spark/`](../../skills/loyal-spark):

```
skills/loyal-spark/
├── SKILL.md                       # entry point with frontmatter (name, description, version)
├── package.json                   # for Vercel skills.sh CLI metadata
├── references/
│   ├── auth.md                    # lsk_ vs rwk_ personas, scopes
│   ├── calldata-flow.md           # builder code, signer pairing
│   ├── base-mcp-integration.md    # paired flow with Base MCP
│   ├── x402-paid.md               # paid corridor (x402 + MPP)
│   ├── gift-certificates.md       # LOYAL-XXXXXX states & batch limits
│   ├── install.md                 # per-surface install instructions
│   └── tone.md                    # voice, attribution, write-safety
└── plugins/
    └── loyal-spark.md             # Base MCP-compatible plugin file for outreach
```

Treat `skills/loyal-spark/SKILL.md` as canonical. Everything else is a copy of this for each distribution surface.

---

## 1. Own GitHub repository — `loyalspark/skills`

This is the primary distribution channel. Vercel's `skills.sh` CLI can install any skill bundle from `github.com/<org>/<repo>`.

### 1.1 Create the repo

1. Create empty public repo `loyalspark/skills` on GitHub (org account).
2. Push the directory:
   ```bash
   git clone https://github.com/loyalspark/skills.git
   cp -R skills/* loyalspark-skills/
   cd loyalspark-skills
   git add . && git commit -m "Add loyal-spark skill v0.1.0"
   git push
   ```
3. Add a top-level `LICENSE` (MIT) and root `README.md` (already in `skills/README.md` in this repo — copy it as the root README).
4. Tag the release:
   ```bash
   git tag loyal-spark-v0.1.0
   git push --tags
   ```
5. Create a GitHub Release named `loyal-spark-v0.1.0` and attach `loyal-spark.zip` (see §2.1 for how to build it).

### 1.2 Install command

After the repo exists, this becomes the canonical install:

```bash
npx skills add loyalspark/skills --skill loyal-spark
```

Update the following Loyal Spark surfaces to mention this command:

- `README.md` (project root) — Agents section
- `public/for-agents.md` — install snippet
- `public/llms.txt` and `public/llms-full.txt` — install section
- `public/.well-known/skills/index.md` — top of file
- `public/.well-known/agent.json` — add a `skill` field pointing to the GitHub repo

### 1.3 Optional: register on agentskills.io

[agentskills.io](https://agentskills.io/) is the public directory `skills.sh` uses. Submit `loyalspark/skills` once published — no payment required, just a form.

---

## 2. Anthropic Claude Skills

Claude users can upload a zip in `claude.ai → Customize → Skills` ([docs](https://support.claude.com/en/articles/12512180-use-skills-in-claude)).

### 2.1 Build the zip

```bash
cd skills/loyal-spark
zip -r ../../dist/loyal-spark-v0.1.0.zip . -x "*.DS_Store"
```

The zip root must contain `SKILL.md` (frontmatter required). Our `SKILL.md` already has:

```yaml
---
name: loyal-spark
description: <one-paragraph trigger description>
version: 0.1.0
homepage: https://loyalspark.online
---
```

### 2.2 Upload

1. Sign in to claude.ai with the workspace that owns the Loyal Spark marketing.
2. Open **Customize → Skills** → **Upload skill**.
3. Pick `loyal-spark-v0.1.0.zip`.
4. Toggle the skill **on** for the workspace.

The skill activates automatically when a prompt matches the description (so the description is the most important field — keep it specific to "onchain loyalty programs on Base", with concrete verbs the user is likely to type).

### 2.3 Re-upload on changes

Bump `version` in `SKILL.md` and `package.json`, rebuild the zip, attach it as a new GitHub Release asset, and re-upload to Anthropic.

---

## 3. ChatGPT Skills

ChatGPT Skills are gated to **Business, Enterprise, Edu, Teachers, Healthcare** plans ([help article](https://help.openai.com/en/articles/20001066-skills-in-chatgpt)). For the free/Plus tier we use the **prompt-onboarding** path.

### 3.1 Persistent skill upload (paid plans)

1. ChatGPT → **Settings → Skills**.
2. **Add skill** → upload the same `loyal-spark-v0.1.0.zip`.
3. Enable per-conversation.

### 3.2 Prompt-onboarding fallback (any plan)

Document this snippet on `public/for-agents` and in `docs/agents/QUICKSTART.md`:

> I'd like to use Loyal Spark. For setup notes, please open
> `https://loyalspark.online/skills/loyal-spark/SKILL.md` as your reference.
> If your built-in browser can't reach the page, the Loyal Spark MCP also
> exposes the same files under `/skills/loyal-spark/references/…` and
> `/skills/loyal-spark/plugins/…`. Open each reference only when relevant.

For this to work we must **serve the skill bundle from `loyalspark.online/skills/loyal-spark/`** (next section).

---

## 4. Self-host the skill at `loyalspark.online/skills/`

Already prepared in this repo: the skill files live under `skills/loyal-spark/`. Add a static route so they are publicly fetchable.

Options:

1. **Easiest**: copy `skills/loyal-spark/` into `public/skills/loyal-spark/` as part of the build, so Vite serves them as static assets. Add to the build script:
   ```bash
   cp -R skills/loyal-spark public/skills/
   ```
2. **Or**: redirect `/skills/*` to the raw GitHub `loyalspark/skills` via an edge function. Simpler if we want a single source.

Verify after deploy:

- `curl https://loyalspark.online/skills/loyal-spark/SKILL.md` → 200, text/markdown
- `curl https://loyalspark.online/skills/loyal-spark/references/install.md` → 200

Update `SKILL.md`'s "Fallback — web" section once the URL is live (already references `https://loyalspark.online/skills/loyal-spark/`).

---

## 5. Outreach to Base — native plugin in `base/skills`

Even though the repo is closed to PRs today, we can pre-package the plugin file so it is **ready to drop in** the day Base opens contributions or accepts partner plugins.

### 5.1 What to send

Single Markdown file: [`skills/loyal-spark/plugins/loyal-spark.md`](../../skills/loyal-spark/plugins/loyal-spark.md). It follows the exact format of existing Base native plugins (`morpho.md`, `moonwell.md`, etc.) — frontmatter with `title` + `description`, then onboarding, environment detection, tool routing, paired execution flow.

### 5.2 Channels

| Channel | Contact / link | Ask |
| --- | --- | --- |
| Base Discord — `#agents` / `#dev` | https://base.org/discord | Drop the plugin file + ask which contact handles partner plugin PRs |
| `base/skills` GitHub Issue | https://github.com/base/skills/issues | Open issue titled "Partner plugin proposal: Loyal Spark (onchain loyalty)" with the plugin Markdown inline |
| Base BD / Ecosystem | `ecosystem@base.org` (public mailbox) | Short pitch + link to the plugin file on our GitHub |
| `base-mcp` repo if it exists separately | check `base/base-mcp` | Same plugin file |
| Coinbase Developer Platform forum | https://forums.coinbase.com | Cross-post the proposal |

### 5.3 Issue / email template

```
Subject: Partner plugin proposal — Loyal Spark (onchain loyalty on Base)

Hi Base team,

Loyal Spark is an onchain loyalty protocol on Base mainnet (chain 8453). Merchants deploy ERC-20 loyalty programs, mint and transfer points, manage rewards, vouchers, and `LOYAL-XXXXXX` gift certificates, and trade tokens on a P2P escrow marketplace. Builder Code `bc_wdmnog7m` (ERC-8021) is appended to every prepared calldata for onchain attribution.

We already operate two MCP servers (Streamable HTTP):
- merchant: https://api.loyalspark.online/loyalty-mcp  (32 tools)
- recipient: https://api.loyalspark.online/recipient-loyalty-mcp  (14 tools)

We have packaged a Base MCP-compatible plugin file mirroring the format of `plugins/morpho.md` etc. Repo: https://github.com/loyalspark/skills, file: skills/loyal-spark/plugins/loyal-spark.md.

Would you accept a PR adding `skills/base-mcp/plugins/loyal-spark.md` to `base/skills`, or is there another preferred process for partner plugins? Happy to scope down or adjust formatting to match.

Thanks,
<name>, Loyal Spark
```

### 5.4 What "approved" looks like

A merged PR adds `skills/base-mcp/plugins/loyal-spark.md` to `base/skills`. Then Base MCP users automatically get our plugin via `npx skills add base/skills --skill base-mcp` — no extra install on the user side.

---

## 6. Per-surface install snippets (for documentation parity)

These must match what `references/install.md` says. Update both at the same time.

| Surface | Command / location |
| --- | --- |
| Claude Desktop / Claude.ai | Customize → Connectors → custom MCP URL `https://api.loyalspark.online/loyalty-mcp` + header `x-api-key` |
| ChatGPT | Settings → Connectors → Create app, MCP URL + custom header `x-api-key` |
| Claude Code | `claude mcp add --transport http --scope user loyal-spark https://api.loyalspark.online/loyalty-mcp --header "x-api-key: lsk_…"` |
| Codex | `codex mcp add loyal-spark --url https://api.loyalspark.online/loyalty-mcp --header "x-api-key=lsk_…"` |
| Cursor | `.cursor/mcp.json` block (see `references/install.md`) |
| Hermes | `~/.hermes/config.yaml` block |
| Skill bundle | `npx skills add loyalspark/skills --skill loyal-spark` (after §1) |

---

## 7. Release checklist (each version)

- [ ] Bump `version` in `skills/loyal-spark/SKILL.md` and `skills/loyal-spark/package.json`.
- [ ] Update `CHANGELOG.md` (this repo) under a `## Skills — loyal-spark vX.Y.Z` section.
- [ ] Copy `skills/loyal-spark/` to `public/skills/loyal-spark/` (build step) so `loyalspark.online/skills/...` serves it.
- [ ] Push to `loyalspark/skills`, tag `loyal-spark-vX.Y.Z`, build `dist/loyal-spark-vX.Y.Z.zip`.
- [ ] Attach the zip to the GitHub Release.
- [ ] Re-upload the zip to claude.ai → Customize → Skills.
- [ ] Re-upload to ChatGPT → Settings → Skills (paid plans).
- [ ] If Base accepted the plugin: open a PR in `base/skills` bumping the plugin file.
- [ ] Smoke test on each surface: ask "Show me Loyal Spark loyalty programs", confirm onboarding + a successful `list_loyalty_programs` call.

---

## 8. What this guide does **not** change in the product

This task is **discovery and distribution only**. No edits to:

- `supabase/functions/**` (MCP servers and edge functions stay as-is)
- `src/**` (frontend stays as-is)
- Smart contracts or builder code
- Pricing or x402/MPP manifests (already synced in a previous round)

If a future version of the skill needs a new MCP tool, that is a separate product PR, not a skill update.
