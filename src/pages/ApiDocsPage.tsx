import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Bot, Key, Shield, Zap, Lightbulb, Network, BadgeCheck, Users, TrendingUp, Puzzle, BookOpen, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import SiteHeader from '@/components/SiteHeader';
import McpServerSection from '@/components/api-docs/McpServerSection';
import MppSection from '@/components/api-docs/MppSection';

import { PUBLIC_REST_URL } from '@/config/publicApi';

const BASE_URL = PUBLIC_REST_URL;

interface Endpoint {
  method: string;
  path: string;
  description: string;
  scope: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  queryParams?: { name: string; type: string; required: boolean; description: string }[];
  exampleRequest?: string;
  exampleResponse: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/me',
    description: 'Get information about the authenticated agent',
    scope: 'any',
    exampleResponse: `{
  "agent": {
    "id": "uuid",
    "name": "CoffeeBot",
    "owner_address": "0x...",
    "scopes": ["read", "mint"]
  }
}`,
  },
  {
    method: 'GET',
    path: '/programs',
    description: 'List all loyalty programs owned by the agent\'s merchant',
    scope: 'read',
    exampleResponse: `{
  "programs": [
    {
      "id": "uuid",
      "name": "Coffee Rewards",
      "symbol": "COFFEE",
      "token_address": "0x...",
      "status": "active",
      "expiration_date": "2027-01-01T00:00:00Z",
      "created_at": "2026-03-21T00:00:00Z"
    }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/programs',
    description: 'Get calldata to deploy a new ERC-20 loyalty token via factory contract. Returns transaction data for on-chain execution.',
    scope: 'create_program',
    params: [
      { name: 'name', type: 'string', required: true, description: 'Token name (e.g. Coffee Rewards)' },
      { name: 'symbol', type: 'string', required: true, description: 'Token symbol (e.g. COFFEE)' },
      { name: 'expiration_days', type: 'number', required: false, description: 'Program duration in days (default 365)' },
    ],
    exampleRequest: `{
  "name": "Coffee Rewards",
  "symbol": "COFFEE",
  "expiration_days": 365
}`,
    exampleResponse: `{
  "calldata": {
    "to": "0x5F3DdBa12580CFdc6016258774cCc19C4250dA80",
    "data": "0x...",
    "value": "0"
  },
  "message": "Send this transaction to deploy your loyalty token"
}`,
  },
  {
    method: 'POST',
    path: '/register-program',
    description: 'Register a deployed token as a loyalty program in the database after on-chain deployment.',
    scope: 'create_program',
    params: [
      { name: 'name', type: 'string', required: true, description: 'Program name' },
      { name: 'symbol', type: 'string', required: true, description: 'Token symbol' },
      { name: 'token_address', type: 'string', required: true, description: 'Deployed token contract address' },
      { name: 'expiration_days', type: 'number', required: false, description: 'Program duration in days' },
      { name: 'use_agent_wallet', type: 'boolean', required: false, description: 'If true, bind program to your CDP server wallet' },
      { name: 'cashback_rate', type: 'number', required: false, description: 'Default cashback % for POST /earn (1–100); omit for 5' },
      { name: 'points_per_dollar', type: 'number', required: false, description: 'Points per $1 spent (1–1000); omit for 1' },
    ],
    exampleRequest: `{
  "name": "Coffee Rewards",
  "symbol": "COFFEE",
  "token_address": "0x1234...abcd",
  "expiration_days": 365,
  "cashback_rate": 5,
  "points_per_dollar": 1
}`,
    exampleResponse: `{
  "program": {
    "id": "uuid",
    "name": "Coffee Rewards",
    "symbol": "COFFEE",
    "token_address": "0x1234...abcd",
    "status": "inactive",
    "cashback_rate": 5,
    "points_per_dollar": 1
  }
}`,
  },
  {
    method: 'POST',
    path: '/update-program-config',
    description: 'Change default cashback_rate and/or points_per_dollar for a program (same fields as merchant dashboard).',
    scope: 'create_program',
    params: [
      { name: 'token_address', type: 'string', required: true, description: 'Program token contract' },
      { name: 'cashback_rate', type: 'number', required: false, description: 'New default cashback % (1–100)' },
      { name: 'points_per_dollar', type: 'number', required: false, description: 'New points per $1 (1–1000)' },
    ],
    exampleRequest: `{
  "token_address": "0x1234...abcd",
  "cashback_rate": 7.5,
  "points_per_dollar": 2
}`,
    exampleResponse: `{
  "program": {
    "id": "uuid",
    "cashback_rate": 7.5,
    "points_per_dollar": 2
  },
  "message": "Program economics updated"
}`,
  },
  {
    method: 'POST',
    path: '/activate-program',
    description: 'Get activation calldata (unpauseUtility + enableMinting). Returns 2 transactions to execute on-chain.',
    scope: 'create_program',
    params: [
      { name: 'token_address', type: 'string', required: true, description: 'Token contract address to activate' },
    ],
    exampleRequest: `{
  "token_address": "0x1234...abcd"
}`,
    exampleResponse: `{
  "transactions": [
    { "to": "0x...", "data": "0x...", "description": "unpauseUtility" },
    { "to": "0x...", "data": "0x...", "description": "enableMinting" }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/program-status',
    description: 'Update program status in database after on-chain activation or pause.',
    scope: 'create_program',
    params: [
      { name: 'token_address', type: 'string', required: true, description: 'Token contract address' },
      { name: 'status', type: 'string', required: true, description: 'New status: "active" or "paused"' },
    ],
    exampleRequest: `{
  "token_address": "0x1234...abcd",
  "status": "active"
}`,
    exampleResponse: `{
  "success": true,
  "message": "Program status updated to active"
}`,
  },
  {
    method: 'GET',
    path: '/rewards',
    description: 'List rewards for a specific program',
    scope: 'read',
    queryParams: [
      { name: 'token_address', type: 'string', required: false, description: 'Filter by program token address' },
    ],
    exampleResponse: `{
  "rewards": [
    {
      "id": "uuid",
      "name": "Free Coffee",
      "description": "One free coffee of any size",
      "cost": 100,
      "is_active": true,
      "token_address": "0x..."
    }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/rewards',
    description: 'Create a new reward for a loyalty program',
    scope: 'manage_rewards',
    params: [
      { name: 'name', type: 'string', required: true, description: 'Reward name (max 100 chars)' },
      { name: 'description', type: 'string', required: false, description: 'Reward description' },
      { name: 'cost', type: 'number', required: true, description: 'Cost in loyalty tokens' },
      { name: 'token_address', type: 'string', required: true, description: 'Program token address (0x...)' },
    ],
    exampleRequest: `{
  "name": "Free Coffee",
  "description": "One free coffee of any size",
  "cost": 100,
  "token_address": "0x1234...abcd"
}`,
    exampleResponse: `{
  "reward": {
    "id": "uuid",
    "name": "Free Coffee",
    "cost": 100,
    "is_active": true,
    "created_at": "2026-03-21T00:00:00Z"
  }
}`,
  },
  {
    method: 'POST',
    path: '/mint',
    description: 'Record a mint intent to issue loyalty tokens to a customer. Returns contract call instructions for on-chain execution.',
    scope: 'mint',
    params: [
      { name: 'token_address', type: 'string', required: true, description: 'Program token address (0x...)' },
      { name: 'recipient_address', type: 'string', required: true, description: 'Customer wallet address (0x...)' },
      { name: 'amount', type: 'number', required: true, description: 'Number of tokens to mint (max 1B)' },
    ],
    exampleRequest: `{
  "token_address": "0x1234...abcd",
  "recipient_address": "0xabcd...1234",
  "amount": 500
}`,
    exampleResponse: `{
  "mint": {
    "id": "uuid",
    "amount": 500,
    "recipient_address": "0xabcd...1234",
    "token_address": "0x1234...abcd"
  },
  "message": "Mint intent recorded. Call the smart contract to complete.",
  "contract": {
    "token_address": "0x1234...abcd",
    "function": "mint(address,uint256)",
    "params": ["0xabcd...1234", 500]
  }
}`,
  },
  {
    method: 'POST',
    path: '/transfer',
    description: 'Transfer loyalty tokens between wallets. Returns calldata with Builder Code for on-chain execution.',
    scope: 'mint',
    params: [
      { name: 'token_address', type: 'string', required: true, description: 'Program token address (0x...)' },
      { name: 'to', type: 'string', required: true, description: 'Recipient wallet address (0x...)' },
      { name: 'amount', type: 'number', required: true, description: 'Number of tokens to transfer' },
    ],
    exampleRequest: `{
  "token_address": "0x1234...abcd",
  "to": "0xabcd...1234",
  "amount": 100
}`,
    exampleResponse: `{
  "calldata": {
    "to": "0x1234...abcd",
    "data": "0x...",
    "value": "0"
  },
  "message": "Send this transaction to transfer tokens"
}`,
  },
  {
    method: 'GET',
    path: '/balance',
    description: 'Get a customer\'s token balance and tier information',
    scope: 'read',
    queryParams: [
      { name: 'token_address', type: 'string', required: true, description: 'Program token address' },
      { name: 'customer_address', type: 'string', required: true, description: 'Customer wallet address' },
    ],
    exampleResponse: `{
  "balance": {
    "current_balance": 750,
    "tokens_earned_total": 1200,
    "tier": {
      "tier_name": "Gold",
      "tier_level": 3,
      "cashback_multiplier": 1.5
    }
  }
}`,
  },
  {
    method: 'GET',
    path: '/customers',
    description: 'List unique customer addresses for a program',
    scope: 'read',
    queryParams: [
      { name: 'token_address', type: 'string', required: true, description: 'Program token address' },
    ],
    exampleResponse: `{
  "customers": ["0xabc...", "0xdef..."],
  "total": 2
}`,
  },
  {
    method: 'GET',
    path: '/vouchers',
    description: 'List vouchers with optional filters',
    scope: 'read',
    queryParams: [
      { name: 'token_address', type: 'string', required: false, description: 'Filter by program' },
      { name: 'status', type: 'string', required: false, description: 'Filter by status (active, used)' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 50, max 100)' },
    ],
    exampleResponse: `{
  "vouchers": [
    {
      "id": "uuid",
      "code": "ABC123",
      "reward_name": "Free Coffee",
      "cost": 100,
      "status": "active",
      "customer_address": "0x..."
    }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/redeem-reward',
    description: 'Redeem a reward by providing a verified token transfer transaction hash. Verifies the on-chain transfer and creates a voucher for the customer.',
    scope: 'read',
    params: [
      { name: 'reward_id', type: 'string', required: true, description: 'UUID of the reward to redeem' },
      { name: 'customer_address', type: 'string', required: true, description: 'Wallet address of the customer who transferred tokens' },
      { name: 'transaction_hash', type: 'string', required: true, description: 'On-chain tx hash of the token transfer from customer to merchant' },
    ],
    exampleRequest: `{
  "reward_id": "uuid-of-reward",
  "customer_address": "0xCustomer...",
  "transaction_hash": "0xTxHash..."
}`,
    exampleResponse: `{
  "voucher": {
    "id": "uuid",
    "code": "LOYAL-AB12-CD34-EF56-GH78",
    "reward_name": "Free Coffee",
    "cost": 100,
    "status": "active",
    "activated_at": "2026-04-02T...",
    "transaction_hash": "0x..."
  }
}`,
  },
  {
    method: 'POST',
    path: '/vouchers/use',
    description: 'Mark a voucher as used (redeemed by customer). Merchant-only operation.',
    scope: 'manage_rewards',
    params: [
      { name: 'voucher_code', type: 'string', required: false, description: 'Voucher code (e.g. LOYAL-XXXX-XXXX-XXXX-XXXX)' },
      { name: 'voucher_id', type: 'string', required: false, description: 'Voucher UUID (alternative to code)' },
    ],
    exampleRequest: `{
  "voucher_code": "LOYAL-AB12-CD34-EF56-GH78"
}`,
    exampleResponse: `{
  "success": true,
  "voucher": {
    "id": "uuid",
    "code": "LOYAL-AB12-CD34-EF56-GH78",
    "reward_name": "Free Coffee",
    "customer_address": "0x...",
    "cost": 100,
    "status": "used",
    "used_at": "2026-04-02T..."
  }
}`,
  },
  {
    method: 'GET',
    path: '/vouchers/status',
    description: 'Check voucher status by code or ID. Public endpoint — no API key required. Useful for customers to verify their voucher.',
    scope: 'none (public)',
    params: [
      { name: 'code', type: 'string (query)', required: false, description: 'Voucher code (e.g. LOYAL-XXXX-XXXX-XXXX-XXXX)' },
      { name: 'voucher_id', type: 'string (query)', required: false, description: 'Voucher UUID (alternative to code)' },
    ],
    exampleRequest: `GET /vouchers/status?code=LOYAL-AB12-CD34-EF56-GH78`,
    exampleResponse: `{
  "voucher": {
    "id": "uuid",
    "code": "LOYAL-AB12-CD34-EF56-GH78",
    "reward_name": "Free Coffee",
    "cost": 100,
    "status": "active",
    "token_symbol": "COFFEE",
    "merchant_address": "0x...",
    "activated_at": "2026-04-02T...",
    "used_at": null
  }
}`,
  },
  {
    method: 'GET',
    path: '/analytics',
    description: 'Get merchant analytics overview',
    scope: 'read',
    exampleResponse: `{
  "analytics": [
    {
      "program_name": "Coffee Rewards",
      "total_customers": 150,
      "active_customers_30d": 45,
      "total_vouchers_issued": 320,
      "vouchers_redeemed": 180
    }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/offers',
    description: 'List active marketplace offers for token trading',
    scope: 'trade',
    exampleResponse: `{
  "offers": [
    {
      "id": "uuid",
      "creator_address": "0x...",
      "offer_token_address": "0x...",
      "offer_amount": 100,
      "request_token_address": "0x...",
      "request_amount": 50,
      "status": "active"
    }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/offers',
    description: 'Create a new P2P escrow offer for token trading. Returns escrow contract calldata for atomic swap.',
    scope: 'trade',
    params: [
      { name: 'offer_token_address', type: 'string', required: true, description: 'Token you are offering' },
      { name: 'offer_amount', type: 'number', required: true, description: 'Amount of tokens to offer' },
      { name: 'request_token_address', type: 'string', required: true, description: 'Token you want in return' },
      { name: 'request_amount', type: 'number', required: true, description: 'Amount of tokens requested' },
    ],
    exampleRequest: `{
  "offer_token_address": "0xabc...",
  "offer_amount": 100,
  "request_token_address": "0xdef...",
  "request_amount": 50
}`,
    exampleResponse: `{
  "offer": { "id": "uuid", "status": "active" },
  "calldata": { "to": "0xA569...", "data": "0x..." }
}`,
  },
  {
    method: 'POST',
    path: '/accept-offer',
    description: 'Accept a P2P offer. Returns escrow contract calldata for fillOffer (atomic swap).',
    scope: 'trade',
    params: [
      { name: 'offer_id', type: 'string', required: true, description: 'UUID of the offer to accept' },
    ],
    exampleRequest: `{ "offer_id": "uuid-of-offer" }`,
    exampleResponse: `{
  "calldata": { "to": "0xA569...", "data": "0x..." },
  "message": "Send this transaction to fill the offer"
}`,
  },
  {
    method: 'POST',
    path: '/cancel-offer',
    description: 'Cancel your own P2P offer. Returns escrow contract calldata for cancelOffer.',
    scope: 'trade',
    params: [
      { name: 'offer_id', type: 'string', required: true, description: 'UUID of the offer to cancel' },
    ],
    exampleRequest: `{ "offer_id": "uuid-of-offer" }`,
    exampleResponse: `{
  "calldata": { "to": "0xA569...", "data": "0x..." },
  "message": "Send this transaction to cancel the offer"
}`,
  },
  {
    method: 'GET',
    path: '/tx-receipt',
    description: 'Extract token_address from a deploy transaction hash. Useful after deploying a new token to get the contract address.',
    scope: 'any',
    queryParams: [
      { name: 'tx_hash', type: 'string', required: true, description: 'Transaction hash from token deployment' },
    ],
    exampleResponse: `{
  "token_address": "0x1234...abcd",
  "block_number": 12345678
}`,
  },
  {
    method: 'GET',
    path: '/export-customers',
    description: 'Export enriched customer data (vouchers, balances, tiers) for a loyalty program. Supports JSON and CSV formats for segmentation and analytics.',
    scope: 'read',
    queryParams: [
      { name: 'token_address', type: 'string', required: true, description: 'Program token address' },
      { name: 'format', type: 'string', required: false, description: 'Response format: "json" (default) or "csv"' },
    ],
    exampleResponse: `{
  "token_address": "0x1234...abcd",
  "total_customers": 3,
  "customers": [
    {
      "wallet": "0xabc...",
      "vouchers_total": 5,
      "vouchers_used": 3,
      "tokens_spent": 500,
      "current_balance": 250,
      "tier": "Gold",
      "first_activity": "2026-01-15T...",
      "last_activity": "2026-04-01T..."
    }
  ]
}`,
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  POST: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  PUT: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
};

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Badge variant="outline" className={`${methodColors[endpoint.method]} font-mono text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shrink-0`}>
          {endpoint.method}
        </Badge>
        <code className="text-xs sm:text-sm font-mono flex-1 break-all">{endpoint.path}</code>
        <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">{endpoint.scope}</Badge>
      </button>

      {expanded && (
        <CardContent className="border-t pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>

          {endpoint.queryParams && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Query Parameters</h4>
              <div className="space-y-2">
                {endpoint.queryParams.map((p) => (
                  <div key={p.name} className="flex flex-wrap items-start gap-1.5 sm:gap-2 text-sm">
                    <code className="text-[10px] sm:text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">{p.name}</code>
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{p.type}</span>
                    {p.required && <Badge variant="destructive" className="text-[10px] px-1 py-0 shrink-0">required</Badge>}
                    <span className="text-[10px] sm:text-xs text-muted-foreground">— {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.params && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Body Parameters</h4>
              <div className="space-y-2">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex flex-wrap items-start gap-1.5 sm:gap-2 text-sm">
                    <code className="text-[10px] sm:text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">{p.name}</code>
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{p.type}</span>
                    {p.required && <Badge variant="destructive" className="text-[10px] px-1 py-0 shrink-0">required</Badge>}
                    <span className="text-[10px] sm:text-xs text-muted-foreground">— {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.exampleRequest && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Request Body</h4>
              <CodeBlock code={endpoint.exampleRequest} />
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Response</h4>
            <CodeBlock code={endpoint.exampleResponse} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function ApiDocsPage() {
  const navigate = useNavigate();

  const curlExample = `curl -X GET "${BASE_URL}/programs" \\
  -H "x-api-key: lsk_YOUR_API_KEY"`;

  const pythonExample = `import requests

API_KEY = "lsk_YOUR_API_KEY"
BASE = "${BASE_URL}"

# List programs
programs = requests.get(
    f"{BASE}/programs",
    headers={"x-api-key": API_KEY}
).json()

# Mint tokens
mint = requests.post(
    f"{BASE}/mint",
    headers={
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    },
    json={
        "token_address": "0x...",
        "recipient_address": "0x...",
        "amount": 100
    }
).json()`;

  const jsExample = `const API_KEY = "lsk_YOUR_API_KEY";
const BASE = "${BASE_URL}";

// List programs
const programs = await fetch(\`\${BASE}/programs\`, {
  headers: { "x-api-key": API_KEY }
}).then(r => r.json());

// Create reward
const reward = await fetch(\`\${BASE}/rewards\`, {
  method: "POST",
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: "Free Coffee",
    cost: 100,
    token_address: "0x..."
  })
}).then(r => r.json());`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "name": "Agent API Documentation — Loyal Spark",
        "url": "https://loyalspark.online/api-docs",
        "description": "REST API and MCP Server docs for AI agents on Base L2 — 17 authenticated routes (12 merchant + 5 recipient), public voucher status, 46 MCP tools (32 merchant + 14 recipient)."
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://loyalspark.online/" },
          { "@type": "ListItem", "position": 2, "name": "API Docs", "item": "https://loyalspark.online/api-docs" }
        ]
      }
    ]
  };

  return (
    <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
              <span className="truncate">Agent API Documentation</span>
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              REST API for AI agents to interact with Loyal Spark loyalty programs
            </p>
            <Link
              to="/for-agents"
              className="text-xs sm:text-sm text-primary font-medium inline-flex items-center gap-1 mt-1 hover:underline underline-offset-4"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Agent onboarding (keys, MCP, discovery)
            </Link>
          </div>

          {/* Why Use Loyal Spark */}
          <Card className="mb-8 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-primary" />
                Why Use Loyal Spark Protocol?
              </CardTitle>
              <CardDescription>
                Why build loyalty infrastructure from scratch when a protocol exists? Think Shopify vs. coding your own store.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: Puzzle, title: 'Full Infrastructure', desc: 'Rewards, vouchers, tiers, analytics, CRM, marketing — all via one API. Creating a token is 5% of the work.' },
                  { icon: Network, title: 'Network Effect', desc: 'Tokens are tradeable on the marketplace, convertible between programs, with real utility through vouchers.' },
                  { icon: BadgeCheck, title: 'Trust & Verification', desc: 'Verified protocol with audit history and buyback mechanism — not just another random token.' },
                  { icon: Users, title: 'Ready-Made Audience', desc: 'Access existing merchant customer bases instantly instead of finding token holders from scratch.' },
                  { icon: TrendingUp, title: 'DeFi Yield', desc: 'Tokens grow via Aave/Compound strategies and Round-Up investing — impossible with a bare ERC-20.' },
                  { icon: Zap, title: 'Composability', desc: 'Program → tiers → referrals → auto-mint → analytics. All through REST API or MCP Server.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Start */}
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Quick Start
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium">Register Agent</p>
                    <p className="text-xs text-muted-foreground">Go to Merchant → AI Agents tab and create an agent</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium">Save API Key</p>
                    <p className="text-xs text-muted-foreground">Copy the <code className="text-xs">lsk_...</code> key — shown only once</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium">Call API</p>
                    <p className="text-xs text-muted-foreground">Use <code className="text-xs">x-api-key</code> header with your key</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Base URL</h4>
                <CodeBlock code={BASE_URL} />
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Authentication</h4>
                <CodeBlock code={curlExample} language="bash" />
              </div>
            </CardContent>
          </Card>

          {/* Scopes */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Permission Scopes
              </CardTitle>
              <CardDescription>Each agent has specific scopes that control what actions it can perform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { scope: 'read', desc: 'View programs, rewards, balances, customers, analytics' },
                  { scope: 'create_program', desc: 'Deploy new loyalty programs (future)' },
                  { scope: 'mint', desc: 'Issue loyalty tokens to customers' },
                  { scope: 'trade', desc: 'View and create marketplace offers' },
                  { scope: 'manage_rewards', desc: 'Create and manage reward items' },
                ].map(({ scope, desc }) => (
                  <div key={scope} className="flex items-start gap-2 p-2 rounded border">
                    <Badge variant="outline" className="text-xs mt-0.5 shrink-0">{scope}</Badge>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Code Examples */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5 text-primary" />
                Code Examples
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="python">
                <TabsList>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                </TabsList>
                <TabsContent value="python" className="mt-4">
                  <CodeBlock code={pythonExample} language="python" />
                </TabsContent>
                <TabsContent value="javascript" className="mt-4">
                  <CodeBlock code={jsExample} language="javascript" />
                </TabsContent>
                <TabsContent value="curl" className="mt-4">
                  <CodeBlock code={curlExample} language="bash" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* MCP Server */}
          <McpServerSection />

          {/* MPP - Machine Payments Protocol */}
          <MppSection />

          {/* Endpoints */}
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4">API Endpoints</h2>
            <div className="space-y-2">
              {ENDPOINTS.map((ep) => (
                <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} />
              ))}
            </div>
          </div>

          {/* Error Codes */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Error Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  { code: 400, desc: 'Bad Request — missing or invalid parameters' },
                  { code: 401, desc: 'Unauthorized — missing or invalid API key' },
                  { code: 403, desc: 'Forbidden — agent lacks required scope' },
                  { code: 404, desc: 'Not Found — resource doesn\'t exist or not owned by you' },
                  { code: 500, desc: 'Internal Server Error — something went wrong' },
                ].map(({ code, desc }) => (
                  <div key={code} className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">{code}</Badge>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Skills Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Skills for AI Agents
              </CardTitle>
              <CardDescription>
                Structured step-by-step guides that teach AI agents how to use each protocol feature
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { id: '00', name: 'Getting Started', desc: 'Register agent, get API key, first request' },
                  { id: '01', name: 'Create Loyalty Program', desc: 'Deploy ERC-20 loyalty token on Base' },
                  { id: '02', name: 'Mint Tokens', desc: 'Mint tokens to customer wallets' },
                  { id: '03', name: 'Transfer Tokens', desc: 'Transfer tokens between wallets' },
                  { id: '04', name: 'Manage Rewards', desc: 'Create redeemable rewards catalog' },
                  { id: '05', name: 'Balance & Tiers', desc: 'Check balances and tier status' },
                  { id: '06', name: 'Marketplace Trading', desc: 'P2P token trading with atomic escrow' },
                  { id: '07', name: 'Analytics & CRM', desc: 'Program analytics and CRM data' },
                  { id: '08', name: 'Referrals', desc: 'Referral programs for organic growth' },
                  { id: '09', name: 'Vouchers', desc: 'Voucher lifecycle management' },
                  { id: '10', name: 'Server Wallets', desc: 'CDP MPC wallets for autonomous transactions' },
                ].map((skill) => (
                  <a
                    key={skill.id}
                    href={`/.well-known/skills/${skill.id}-${skill.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}.md`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">{skill.id}</Badge>
                      <div>
                        <span className="font-medium text-sm">{skill.name}</span>
                        <p className="text-xs text-muted-foreground">{skill.desc}</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Skills index: <code className="text-primary">/.well-known/skills/index.md</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
