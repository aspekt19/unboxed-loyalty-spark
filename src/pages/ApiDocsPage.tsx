import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Copy, Check, Bot, Key, Shield, Zap, Lightbulb, Network, BadgeCheck, Users, TrendingUp, Puzzle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import McpServerSection from '@/components/api-docs/McpServerSection';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-api`;

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
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Badge variant="outline" className={`${methodColors[endpoint.method]} font-mono text-xs px-2 py-0.5`}>
          {endpoint.method}
        </Badge>
        <code className="text-sm font-mono flex-1">{endpoint.path}</code>
        <Badge variant="secondary" className="text-xs">{endpoint.scope}</Badge>
      </button>

      {expanded && (
        <CardContent className="border-t pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>

          {endpoint.queryParams && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Query Parameters</h4>
              <div className="space-y-1">
                {endpoint.queryParams.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.name}</code>
                    <span className="text-xs text-muted-foreground">{p.type}</span>
                    {p.required && <Badge variant="destructive" className="text-[10px] px-1 py-0">required</Badge>}
                    <span className="text-xs text-muted-foreground">— {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.params && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Body Parameters</h4>
              <div className="space-y-1">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.name}</code>
                    <span className="text-xs text-muted-foreground">{p.type}</span>
                    {p.required && <Badge variant="destructive" className="text-[10px] px-1 py-0">required</Badge>}
                    <span className="text-xs text-muted-foreground">— {p.description}</span>
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

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                Agent API Documentation
              </h1>
              <p className="text-muted-foreground text-sm">
                REST API for AI agents to interact with Loyal Spark loyalty programs
              </p>
            </div>
          </div>

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
        </div>
      </div>
    </PageTransition>
  );
}
