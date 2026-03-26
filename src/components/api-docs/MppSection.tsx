import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Zap, DollarSign } from 'lucide-react';

const MPP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpp-gateway`;

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
  const cliExample = `# Install mppx CLI
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

  const codeExample = `import { Mppx, tempo } from 'mppx/client';
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

  const flowExample = `# How MPP 402 flow works:

1. Agent sends request to MPP gateway
   → GET /mpp-gateway/programs -H "x-api-key: lsk_..."

2. Gateway returns HTTP 402 Payment Required
   → WWW-Authenticate: Payment realm="mpp"
   → X-MPP-Price-USD: 0.001

3. Agent's mppx client auto-pays in pathUSD on Tempo
   → Signs and submits payment transaction

4. Agent retries with payment credential
   → Authorization: Payment <credential>

5. Gateway verifies payment, proxies to agent-api
   → Returns data + Receipt header`;

  return (
    <Card className="mb-8 border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-amber-500" />
          MPP — Machine Payments Protocol
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">NEW</Badge>
        </CardTitle>
        <CardDescription>
          Pay per API request with no subscription needed. Uses the open{' '}
          <a href="https://mpp.dev" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Machine Payments Protocol
          </a>{' '}
          (by Stripe × Tempo) for automatic HTTP 402 payment flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gateway URL */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">MPP Gateway URL</h4>
          <CodeBlock code={MPP_URL} />
        </div>

        {/* Payment info */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Currency:</span>
          <Badge variant="outline" className="text-xs">pathUSD (Tempo)</Badge>
          <span className="text-sm text-muted-foreground">Protocol:</span>
          <Badge variant="outline" className="text-xs">HTTP 402</Badge>
          <span className="text-sm text-muted-foreground">SDK:</span>
          <Badge variant="outline" className="text-xs">mppx</Badge>
        </div>

        {/* How to use */}
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Usage</h4>
          <Tabs defaultValue="cli">
            <TabsList>
              <TabsTrigger value="cli">mppx CLI</TabsTrigger>
              <TabsTrigger value="code">TypeScript SDK</TabsTrigger>
              <TabsTrigger value="flow">How It Works</TabsTrigger>
            </TabsList>
            <TabsContent value="cli" className="mt-4">
              <CodeBlock code={cliExample} />
            </TabsContent>
            <TabsContent value="code" className="mt-4">
              <CodeBlock code={codeExample} />
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
            Per-Request Pricing
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

        {/* Comparison note */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm font-medium mb-1">💡 MPP vs Subscription</p>
          <p className="text-xs text-muted-foreground">
            MPP is ideal for agents making occasional requests. For high-volume usage, the subscription plans 
            (Free / Pro $29/mo / Enterprise $99/mo) with API key authentication offer better value. 
            Both methods can be used in parallel — same API key works with both.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
