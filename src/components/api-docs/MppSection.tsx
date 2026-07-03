import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Zap, DollarSign, Shield } from 'lucide-react';

import { PUBLIC_MPP_URL, PUBLIC_X402_URL } from '@/config/publicApi';

const MPP_URL = PUBLIC_MPP_URL;
const X402_URL = PUBLIC_X402_URL;

function CodeBlock({ code }: { code: string }) {
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

const PRICING_TABLE = [
  { endpoint: 'GET /me', price: 'Free', category: 'read' },
  { endpoint: 'GET /programs', price: '$0.001', category: 'read' },
  { endpoint: 'GET /rewards', price: '$0.001', category: 'read' },
  { endpoint: 'GET /balance', price: '$0.001', category: 'read' },
  { endpoint: 'GET /customers', price: '$0.002', category: 'read' },
  { endpoint: 'GET /vouchers', price: '$0.001', category: 'read' },
  { endpoint: 'GET /analytics', price: '$0.005', category: 'read' },
  { endpoint: 'GET /offers', price: '$0.001', category: 'read' },
  { endpoint: 'POST /programs', price: '$0.05', category: 'write' },
  { endpoint: 'POST /register-program', price: '$0.01', category: 'write' },
  { endpoint: 'POST /update-program-config', price: '$0.005', category: 'write' },
  { endpoint: 'POST /activate-program', price: '$0.01', category: 'write' },
  { endpoint: 'POST /program-status', price: '$0.005', category: 'write' },
  { endpoint: 'POST /rewards', price: '$0.01', category: 'write' },
  { endpoint: 'POST /mint', price: '$0.01', category: 'write' },
  { endpoint: 'POST /transfer', price: '$0.005', category: 'write' },
  { endpoint: 'POST /offers', price: '$0.01', category: 'trade' },
  { endpoint: 'POST /accept-offer', price: '$0.01', category: 'trade' },
  { endpoint: 'POST /cancel-offer', price: '$0.005', category: 'trade' },
];

export default function MppSection() {
  const [activeProtocol, setActiveProtocol] = useState<'mpp' | 'x402'>('mpp');

  // MPP examples
  const mppCliExample = `# Install mppx CLI
npm install -g mppx

# Create a Tempo wallet (auto-funded on testnet)
mppx account create

# Make a paid request — payment handled automatically
mppx ${MPP_URL}/programs \\
  -H "x-api-key: lsk_YOUR_API_KEY"

# Mint tokens (POST)
mppx ${MPP_URL}/mint \\
  -X POST \\
  -H "x-api-key: lsk_YOUR_API_KEY" \\
  -d '{"token_address":"0x...","recipient_address":"0x...","amount":100}'`;

  const mppCodeExample = `import { Mppx, tempo } from 'mppx/client';
import { privateKeyToAccount } from 'viem/accounts';

// Set up MPP client with your Tempo wallet
const mppx = Mppx.create({
  account: privateKeyToAccount('0x...'), // Your Tempo wallet
  methods: [tempo()],
});

// Global fetch now handles 402 automatically
const res = await fetch('${MPP_URL}/programs', {
  headers: { 'x-api-key': 'lsk_YOUR_API_KEY' },
});
const data = await res.json();
console.log(data.programs);`;

  // x402 examples
  const x402CliExample = `# Install x402 fetch wrapper
npm install @x402/fetch @x402/evm

# Using curl — first get payment requirements
curl -i ${X402_URL}/programs \\
  -H "x-api-key: lsk_YOUR_API_KEY"

# Response: HTTP 402 with PAYMENT-REQUIRED header (base64 challenge)
# Use x402 SDK to sign and retry automatically
# Note: Node.js default fetch (maxHeaderSize=16384) handles this correctly —
# the challenge is sent once in the PAYMENT-REQUIRED header only.

  const x402CodeExample = `import { wrapFetch } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

// Wrap fetch with x402 payment handling
const x402Fetch = wrapFetch(fetch, {
  schemes: [
    new ExactEvmScheme({
      account: privateKeyToAccount('0x...'), // Base wallet with USDC
    }),
  ],
});

// Fetch handles 402 + USDC payment automatically
const res = await x402Fetch('${X402_URL}/programs', {
  headers: { 'x-api-key': 'lsk_YOUR_API_KEY' },
});
const data = await res.json();
console.log(data.programs);

// POST example — mint tokens
const mintRes = await x402Fetch('${X402_URL}/mint', {
  method: 'POST',
  headers: {
    'x-api-key': 'lsk_YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token_address: '0x...',
    recipient_address: '0x...',
    amount: 100,
  }),
});`;

  const flowExample = activeProtocol === 'mpp' 
    ? `# How MPP 402 flow works:

1. Agent sends request to MPP gateway
   → GET /mpp-gateway/programs -H "x-api-key: lsk_..."

2. Gateway returns HTTP 402 Payment Required
   → WWW-Authenticate: Payment realm="mpp"
   → X-MPP-Price-USD: 0.001

3. Agent's mppx client auto-pays in USDC/pathUSD on Tempo
   → Signs and submits payment transaction

4. Agent retries with payment credential
   → Authorization: Payment <credential>

5. Gateway verifies payment, proxies to agent-api
   → Returns data + Receipt header`
    : `# How x402 402 flow works:

1. Agent sends request to x402 gateway
   → GET /x402-gateway/programs -H "x-api-key: lsk_..."

2. Gateway returns HTTP 402 Payment Required
   → X-Payment-Required: <base64 payment requirements>
   → Includes: amount, USDC asset, Base network, payTo address

3. Agent's x402 client signs USDC transfer on Base
   → EIP-3009 authorization (gasless for USDC)

4. Agent retries with signed payment
   → X-PAYMENT: <base64 signed payment payload>

5. Gateway verifies via Coinbase facilitator
   → Settles USDC on-chain, returns data
   → X-Payment-Response: settled
   → X-Payment-TxHash: 0x...`;

  return (
    <Card className="mb-8 border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-amber-500" />
          Pay-Per-Request Protocols
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">NEW</Badge>
        </CardTitle>
        <CardDescription>
          Pay per API request with no subscription needed. Two protocols supported for maximum agent compatibility.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Protocol selector */}
        <div className="flex gap-2">
          <Button
            variant={activeProtocol === 'mpp' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveProtocol('mpp')}
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            MPP (Tempo)
          </Button>
          <Button
            variant={activeProtocol === 'x402' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveProtocol('x402')}
            className="gap-1.5"
          >
            <Shield className="h-3.5 w-3.5" />
            x402 (Coinbase)
          </Button>
        </div>

        {/* Protocol info */}
        {activeProtocol === 'mpp' ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">MPP Gateway URL</h4>
              <CodeBlock code={MPP_URL} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Currency:</span>
              <Badge variant="outline" className="text-xs">USDC / pathUSD (Tempo)</Badge>
              <span className="text-sm text-muted-foreground">Protocol:</span>
              <Badge variant="outline" className="text-xs">HTTP 402</Badge>
              <span className="text-sm text-muted-foreground">SDK:</span>
              <Badge variant="outline" className="text-xs">mppx</Badge>
              <span className="text-sm text-muted-foreground">Spec:</span>
              <a href="https://mpp.dev" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">mpp.dev</a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">x402 Gateway URL</h4>
              <CodeBlock code={X402_URL} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Currency:</span>
              <Badge variant="outline" className="text-xs">USDC on Base</Badge>
              <span className="text-sm text-muted-foreground">Protocol:</span>
              <Badge variant="outline" className="text-xs">HTTP 402 (x402)</Badge>
              <span className="text-sm text-muted-foreground">SDK:</span>
              <Badge variant="outline" className="text-xs">@x402/fetch</Badge>
              <span className="text-sm text-muted-foreground">Facilitator:</span>
              <a href="https://facilitator.x402.org" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Coinbase</a>
              <span className="text-sm text-muted-foreground">Spec:</span>
              <a href="https://github.com/coinbase/x402" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">coinbase/x402</a>
            </div>
          </div>
        )}

        {/* Usage examples */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Usage</h4>
          <Tabs defaultValue="cli">
            <TabsList>
              <TabsTrigger value="cli">{activeProtocol === 'mpp' ? 'mppx CLI' : 'curl / CLI'}</TabsTrigger>
              <TabsTrigger value="code">TypeScript SDK</TabsTrigger>
              <TabsTrigger value="flow">How It Works</TabsTrigger>
            </TabsList>
            <TabsContent value="cli" className="mt-4">
              <CodeBlock code={activeProtocol === 'mpp' ? mppCliExample : x402CliExample} />
            </TabsContent>
            <TabsContent value="code" className="mt-4">
              <CodeBlock code={activeProtocol === 'mpp' ? mppCodeExample : x402CodeExample} />
            </TabsContent>
            <TabsContent value="flow" className="mt-4">
              <CodeBlock code={flowExample} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Pricing Table */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Per-Request Pricing (same for both protocols)
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-2 text-xs font-medium text-muted-foreground">Endpoint</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-right p-2 text-xs font-medium text-muted-foreground">Type</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_TABLE.map((row) => (
                  <tr key={row.endpoint} className="border-b last:border-0">
                    <td className="p-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{row.endpoint}</code>
                    </td>
                    <td className="p-2 text-right text-xs font-mono">
                      {row.price === 'Free' ? (
                        <Badge variant="secondary" className="text-[10px]">Free</Badge>
                      ) : row.price}
                    </td>
                    <td className="p-2 text-right">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] ${
                          row.category === 'write' ? 'border-blue-500/30 text-blue-600' :
                          row.category === 'trade' ? 'border-purple-500/30 text-purple-600' :
                          'border-green-500/30 text-green-600'
                        }`}
                      >
                        {row.category}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comparison */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-1">⚡ MPP (Tempo)</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• USDC & pathUSD on Tempo chain</li>
              <li>• Compatible with mpp.dev ecosystem</li>
              <li>• mppx CLI for quick testing</li>
              <li>• Best for: agents in MPP ecosystem</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-1">🛡️ x402 (Coinbase)</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• USDC on Base (native)</li>
              <li>• Coinbase facilitator verification</li>
              <li>• Gasless EIP-3009 transfers</li>
              <li>• Best for: agents with USDC on Base</li>
            </ul>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm font-medium mb-1">💡 Pay-Per-Request vs Subscription</p>
          <p className="text-xs text-muted-foreground">
            Both protocols are ideal for agents making occasional requests. For high-volume usage, the subscription plans 
            (Free / Pro $49/mo / Enterprise $129/mo) with API key authentication offer better value. 
            All three methods (MPP, x402, API key) can be used in parallel — same API key works with all.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
