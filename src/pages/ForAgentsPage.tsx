import { useState } from "react";
import { Link } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  Key,
  Link2,
  Rocket,
  Terminal,
  BookOpen,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import PayPerCallPriceList from "@/components/agents/PayPerCallPriceList";
import { MCP_TOOL_COUNT, MCP_TOOL_NAMES } from "@/constants/mcpToolNames";
import { RECIPIENT_MCP_TOOL_COUNT, RECIPIENT_MCP_TOOL_NAMES } from "@/constants/recipientMcpToolNames";

import {
  PUBLIC_REST_URL,
  PUBLIC_MCP_URL,
  PUBLIC_RECIPIENT_REST_URL,
  PUBLIC_RECIPIENT_MCP_URL,
  PUBLIC_X402_URL,
  PUBLIC_MPP_URL,
  PUBLIC_REGISTER_SIWE_URL,
  PUBLIC_SIWE_NONCE_URL,
} from "@/config/publicApi";

const SITE = "https://loyalspark.online";
const REST = PUBLIC_REST_URL;
const MCP = PUBLIC_MCP_URL;
const RECIPIENT_REST = PUBLIC_RECIPIENT_REST_URL;
const RECIPIENT_MCP = PUBLIC_RECIPIENT_MCP_URL;
const X402 = PUBLIC_X402_URL;
const MPP = PUBLIC_MPP_URL;
const REGISTER_SIWE = PUBLIC_REGISTER_SIWE_URL;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/60 border rounded-lg p-3 sm:p-4 overflow-x-auto text-[11px] sm:text-xs font-mono leading-relaxed max-h-[min(420px,55vh)] overflow-y-auto">
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8"
        onClick={copy}
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

const mcpJson = `{
  "mcpServers": {
    "loyal-spark": {
      "url": "${MCP}",
      "headers": {
        "x-api-key": "lsk_YOUR_API_KEY"
      }
    }
  }
}`;

const recipientMcpJson = `{
  "mcpServers": {
    "loyal-spark-recipient": {
      "url": "${RECIPIENT_MCP}",
      "headers": {
        "x-api-key": "rwk_YOUR_RECIPIENT_KEY"
      }
    }
  }
}`;

const curlProbe = `curl -sS -H "x-api-key: lsk_YOUR_API_KEY" \\
  "${REST}/programs"`;

const merchantSiweFlow = `Autonomous merchant agents (lsk_) — no web login. Same SIWE nonce as everyone else.

1) Nonce:
curl -sS "${PUBLIC_SIWE_NONCE_URL}" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}"

2) Build EIP-4361 message for Base (8453). It MUST contain the exact phrase:
   Register Loyal Spark merchant agent
   and include Chain ID: 8453 and the nonce from step 1. Sign with your merchant wallet.

3) One-time lsk_ key:
curl -sS -X POST "${REGISTER_SIWE}" \\
  -H "Content-Type: application/json" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}" \\
  -d '{"message":"<SIWE message>","signature":"0x...","name":"My agent","scopes":["read","mint","create_program"]}'

Docs: /docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md in the repo.`;

const recipientKeyFlow = `Recipient keys (rwk_) are for wallets that receive loyalty points — not merchants.

1) Nonce (same as web SIWE):
curl -sS "${PUBLIC_SIWE_NONCE_URL}" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}"

2) Build a standards-compliant EIP-4361 SIWE message including that nonce for the recipient wallet; sign with that wallet.

3) One-time key:
curl -sS -X POST "${RECIPIENT_REST}/register" \\
  -H "Content-Type: application/json" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}" \\
  -d '{"message":"<SIWE message>","signature":"0x...","name":"optional label"}'

4) Call APIs with header: x-api-key: rwk_...

5) Send loyalty tokens to any address (holder-signed transfer calldata; program must be active):
curl -sS -X POST "${RECIPIENT_REST}/prepare-transfer" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: rwk_YOUR_RECIPIENT_KEY" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}" \\
  -d '{"token_address":"0x...","to":"0x...","amount":10.5}'

MCP: prepare_loyalty_token_transfer`;

const recipientP2PFlow = `P2P offers — recipient wallets swap loyalty tokens with each other.
The API records intent and returns escrow contract hints. The actual on-chain
swap (token approve + escrow create/accept/cancel) is performed separately
by the wallet — same pattern as the merchant agent-api.

# List open offers (optionally filter by token)
curl -sS "${RECIPIENT_REST}/offers" \\
  -H "x-api-key: rwk_YOUR_RECIPIENT_KEY" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}"

# Create an offer (your wallet = creator)
curl -sS -X POST "${RECIPIENT_REST}/offers" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: rwk_YOUR_RECIPIENT_KEY" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}" \\
  -d '{"offer_token_address":"0x...","offer_amount":"100","request_token_address":"0x...","request_amount":"50"}'

# Accept someone else's offer
curl -sS -X POST "${RECIPIENT_REST}/accept-offer" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: rwk_YOUR_RECIPIENT_KEY" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}" \\
  -d '{"offer_id":"<uuid>","transaction_hash":"0x..."}'

# Cancel your own active offer
curl -sS -X POST "${RECIPIENT_REST}/cancel-offer" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: rwk_YOUR_RECIPIENT_KEY" \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}" \\
  -d '{"offer_id":"<uuid>"}'

MCP equivalents: list_p2p_offers · create_p2p_offer · accept_p2p_offer · cancel_p2p_offer`;

const merchantUseVoucherFlow = `Completing a voucher — after the customer received the reward in the real world,
the merchant agent (scope: manage_rewards) flips its status active → used.
Note: this is the lifecycle transition, not a separate "activation" DB status.

# REST
curl -sS -X POST "${REST}/vouchers/use" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: lsk_YOUR_API_KEY" \\
  -d '{"voucher_id":"<uuid>"}'

# MCP tool: use_voucher  (args: { voucher_id })`;

export default function ForAgentsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "For AI Agents — Loyal Spark",
    url: `${SITE}/for-agents`,
    description:
      `Onboard AI agents to Loyal Spark: API keys, REST, MCP (${MCP_TOOL_COUNT} tools), x402/MPP, discovery URLs, and skills on Base L2.`,
  };

  return (
    <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-background">
        <SiteHeader />

        <div className="border-b border-border bg-muted/30">
          <div className="container max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary shrink-0" />
                <span>For AI agents</span>
              </h1>
              <p className="text-xs text-muted-foreground truncate sm:whitespace-normal">
                Loyalty on Base — REST, MCP, machine payments, one page to go live
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <a href={`${SITE}/merchant`} target="_blank" rel="noreferrer">
                <Key className="h-3.5 w-3.5 mr-1.5" />
                Get API key
              </a>
            </Button>
          </div>
        </div>

        <main className="container max-w-5xl mx-auto px-4 py-8 space-y-10">
          <section className="text-center space-y-3 max-w-3xl mx-auto">
            <Badge variant="secondary" className="text-xs">
              Base mainnet · B20 default · {MCP_TOOL_COUNT} merchant MCP tools · {RECIPIENT_MCP_TOOL_COUNT} recipient MCP tools
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Ship an agent that runs real loyalty programs
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Humans use Privy + the web app. <strong>Merchant agents</strong> use an <code className="text-xs bg-muted px-1 py-0.5 rounded">lsk_</code> key
              and <code className="text-xs bg-muted px-1 py-0.5 rounded">agent-api</code> / <code className="text-xs bg-muted px-1 py-0.5 rounded">loyalty-mcp</code>{" "}
              (dashboard <em>or</em> free SIWE registration — see below).
              <strong> Recipient agents</strong> (wallets that earn points) use <code className="text-xs bg-muted px-1 py-0.5 rounded">rwk_</code> and a separate
              REST + MCP stack — humans never need to touch that. Public voucher lookup needs no key.
            </p>
            <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
              New programs deploy as <strong>B20</strong> on Base by default (one tx, active after register). Legacy <strong>ERC-20</strong> factory remains available via{" "}
              <code className="bg-muted px-1 rounded">token_standard: &quot;erc20&quot;</code>.
            </p>
            <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
              Optional command-line helpers for developers (x402 MCP check, SIWE key flow) live in the GitHub repo under{" "}
              <code className="bg-muted px-1 rounded">scripts/</code> — see the root README; they are not part of the marketing site and are not required to use Loyal Spark.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/api-docs">API reference</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`${SITE}/openapi.json`} target="_blank" rel="noreferrer">
                  OpenAPI <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`${SITE}/.well-known/agent.json`} target="_blank" rel="noreferrer">
                  agent.json <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-4">
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <Terminal className="h-6 w-6 text-primary mb-1" />
                <CardTitle className="text-base">REST</CardTitle>
                <CardDescription>28 authenticated routes + public GET /vouchers/status</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>Base URL (append path):</p>
                <code className="block bg-muted/70 rounded px-2 py-1.5 break-all">{REST}</code>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <Bot className="h-6 w-6 text-primary mb-1" />
                <CardTitle className="text-base">MCP</CardTitle>
                <CardDescription>Streamable HTTP · JSON-RPC 2.0</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>Server URL:</p>
                <code className="block bg-muted/70 rounded px-2 py-1.5 break-all">{MCP}</code>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <Link2 className="h-6 w-6 text-primary mb-1" />
                <CardTitle className="text-base">Pay per call</CardTitle>
                <CardDescription>x402 (USDC Base) · MPP (Tempo)</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p className="break-all">x402: {X402}</p>
                <p className="break-all">MPP: {MPP}</p>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-2 rounded-lg border border-primary/25 bg-muted/20 p-4">
            <h3 className="text-lg font-semibold">Already used by AI agents</h3>
            <p className="text-sm text-muted-foreground">
              Loyal Spark is live in agent marketplaces — autonomous agents discover and pay for our REST and MCP
              resources per call in USDC on Base. Verify live call/payer activity on{" "}
              <a
                href="https://agentic.market/services/api-loyalspark-online"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-4"
              >
                agentic.market
              </a>
              , onchain USDC settlements on{" "}
              <a
                href="https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913?a=0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-4"
              >
                Basescan
              </a>
              , and the paid server listing on{" "}
              <a
                href="https://www.x402scan.com/server/b83f21f5-bdf9-4417-a2b3-0a0cb5e773c0"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-4"
              >
                x402scan
              </a>
              . Crawler map:{" "}
              <a
                href={`${SITE}/index.txt`}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-4"
              >
                index.txt
              </a>
              .
            </p>
          </section>



          <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Three steps
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  step: "1",
                  title: "Merchant",
                  body: "Sign in at loyalspark.online/merchant and open the AI Agents tab.",
                },
                {
                  step: "2",
                  title: "Key",
                  body: "Register an agent and store the lsk_... key in your runtime or MCP headers.",
                },
                {
                  step: "3",
                  title: "Call",
                  body: "Hit /programs or plug MCP into Cursor / Claude — use Skills for guided flows.",
                },
              ].map((s) => (
                <Card key={s.step}>
                  <CardHeader className="pb-2">
                    <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center text-sm">
                      {s.step}
                    </Badge>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{s.body}</CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/15 p-4">
            <h3 className="text-lg font-semibold">Autonomous merchant key (lsk_ via SIWE)</h3>
            <p className="text-sm text-muted-foreground">
              No merchant dashboard: prove wallet ownership with a signed message (Base mainnet). Free key creation; usage is billed per your agent plan like keys from the UI.
            </p>
            <CodeBlock code={merchantSiweFlow} />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">First REST call</h3>
            <CodeBlock code={curlProbe} />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Cursor / VS Code MCP</h3>
            <p className="text-sm text-muted-foreground">
              Merge into <code className="text-xs bg-muted px-1 rounded">.cursor/mcp.json</code> — same JSON lives in the repo under{" "}
              <code className="text-xs bg-muted px-1 rounded">examples/agent-mcp/</code>.
            </p>
            <CodeBlock code={mcpJson} />
          </section>

          <section className="space-y-3 rounded-lg border border-dashed border-primary/25 bg-muted/20 p-4">
            <h3 className="text-lg font-semibold">Recipient AI agents (rwk_)</h3>
            <p className="text-sm text-muted-foreground">
              For autonomous wallets that <strong>receive</strong> loyalty tokens (e.g. another agent thanked on-chain). Keys are created with a SIWE signature from
              that wallet — no merchant dashboard. REST base: <code className="text-xs bg-muted px-1 rounded break-all">{RECIPIENT_REST}</code>
            </p>
            <CodeBlock code={recipientKeyFlow} />
            <p className="text-xs text-muted-foreground">Then: GET /balances, GET /rewards?token_address=..., POST /redeem-reward with reward_id + transfer tx hash.</p>
            <h4 className="text-sm font-medium pt-2">Recipient MCP ({RECIPIENT_MCP_TOOL_COUNT} tools)</h4>
            <p className="text-xs text-muted-foreground break-all">URL: {RECIPIENT_MCP}</p>
            <CodeBlock code={recipientMcpJson} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {RECIPIENT_MCP_TOOL_NAMES.map((name) => (
                <code key={name} className="text-[10px] sm:text-xs bg-muted/80 border rounded px-1.5 py-0.5 font-mono">
                  {name}
                </code>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Source: <code className="bg-muted px-1 rounded">src/constants/recipientMcpToolNames.ts</code> · server{" "}
              <code className="bg-muted px-1 rounded">recipient-loyalty-mcp/index.ts</code>
            </p>
          </section>

          <section>
            <PayPerCallPriceList />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Skills (Markdown)
            </h3>
            <p className="text-sm text-muted-foreground">
              Twelve step-by-step guides (<code className="text-xs bg-muted px-1 rounded">00</code>–
              <code className="text-xs bg-muted px-1 rounded">11</code>) live under{" "}
              <code className="text-xs bg-muted px-1 rounded">/.well-known/skills/</code>.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={`${SITE}/.well-known/skills/index.md`} target="_blank" rel="noreferrer">
                Open skills index <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">MCP tool ids ({MCP_TOOL_COUNT})</h3>
            <p className="text-xs text-muted-foreground">
              Source of truth: <code className="bg-muted px-1 rounded">src/constants/mcpToolNames.ts</code> (sync with{" "}
              <code className="bg-muted px-1 rounded">loyalty-mcp/index.ts</code>).
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MCP_TOOL_NAMES.map((name) => (
                <code key={name} className="text-[10px] sm:text-xs bg-muted/80 border rounded px-1.5 py-0.5 font-mono">
                  {name}
                </code>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-dashed border-primary/25 bg-muted/20 p-4">
            <h3 className="text-lg font-semibold">P2P offers for recipients (rwk_)</h3>
            <p className="text-sm text-muted-foreground">
              Holder wallets can browse open swap offers, post their own (creator = caller's wallet), accept somebody else's, or cancel their own active offer.
              The API only records intent and returns escrow contract hints — the actual on-chain step (token{" "}
              <code className="text-xs bg-muted px-1 rounded">approve</code> + escrow{" "}
              <code className="text-xs bg-muted px-1 rounded">create</code>/<code className="text-xs bg-muted px-1 rounded">accept</code>/<code className="text-xs bg-muted px-1 rounded">cancel</code>) is performed by the wallet, exactly like the merchant <code className="text-xs bg-muted px-1 rounded">agent-api</code>.
            </p>
            <CodeBlock code={recipientP2PFlow} />
            <p className="text-xs text-muted-foreground">
              REST: <code className="bg-muted px-1 rounded break-all">{RECIPIENT_REST}/offers</code> · <code className="bg-muted px-1 rounded">/accept-offer</code> · <code className="bg-muted px-1 rounded">/cancel-offer</code>
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/15 p-4">
            <h3 className="text-lg font-semibold">Completing a voucher (merchant lsk_)</h3>
            <p className="text-sm text-muted-foreground">
              After the customer collects the reward in the real world, a merchant agent with scope{" "}
              <code className="text-xs bg-muted px-1 rounded">manage_rewards</code> flips the voucher{" "}
              <code className="text-xs bg-muted px-1 rounded">active</code> → <code className="text-xs bg-muted px-1 rounded">used</code> via{" "}
              <code className="text-xs bg-muted px-1 rounded">POST /vouchers/use</code> or MCP{" "}
              <code className="text-xs bg-muted px-1 rounded">use_voucher</code>. This is a lifecycle transition — not a separate "activation" status in the database.
            </p>
            <CodeBlock code={merchantUseVoucherFlow} />
          </section>
        </main>
      </div>
    </PageTransition>
  );
}
