# Loyal Spark Skills

Agent skills bundle for [Loyal Spark](https://loyalspark.online). Compatible with the same loader spec as [Base Skills](https://github.com/base/skills) (Vercel's `skills.sh` CLI, Claude Skills, ChatGPT Skills).

## Install

```bash
npx skills add loyalspark/skills --skill loyal-spark
```

Per-surface manual install: see [`loyal-spark/references/install.md`](./loyal-spark/references/install.md).

## Skills

| Skill | Description |
| --- | --- |
| [loyal-spark](./loyal-spark/SKILL.md) | Onchain loyalty programs on Base — create programs, mint points, manage rewards & vouchers, redeem `LOYAL-XXXXXX` gift certificates, P2P escrow marketplace. Pairs with Base MCP for signing. |

## Plugin for Base MCP

A Base MCP-compatible plugin file lives at [`loyal-spark/plugins/loyal-spark.md`](./loyal-spark/plugins/loyal-spark.md) for submission/outreach to the Base team. See [`docs/agents/BASE_SKILLS_SUBMISSION.md`](../docs/agents/BASE_SKILLS_SUBMISSION.md) for the full distribution guide.

## License

MIT.
