import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Mirrors supabase/functions/_shared/recipient-paid-routes.ts (keep in sync).
const RECIPIENT_REST_ROUTE_USD: Record<string, Record<string, string>> = {
  GET: {
    "recipient-api/me": "0",
    "recipient-api/balances": "0.001",
    "recipient-api/balance": "0.001",
    "recipient-api/rewards": "0.001",
    "recipient-api/vouchers": "0.001",
    "recipient-api/offers": "0.001",
  },
  POST: {
    "recipient-api/register": "0",
    "recipient-api/prepare-transfer": "0.005",
    "recipient-api/redeem-reward": "0.01",
    "recipient-api/offers": "0.01",
    "recipient-api/accept-offer": "0.01",
    "recipient-api/cancel-offer": "0.005",
  },
};

// Mirrors supabase/functions/_shared/recipient-mcp-bazaar-tools.ts (keep in sync).
const RECIPIENT_MCP_BAZAAR_TOOLS: ReadonlyArray<{ name: string; price: string; description: string }> = [
  { name: "get_recipient_profile", price: "0.01", description: "Recipient agent profile (rwk_ bound wallet)" },
  { name: "list_my_loyalty_balances", price: "0.01", description: "All loyalty tier balances for your wallet" },
  { name: "get_my_loyalty_balance", price: "0.01", description: "Balance and tier for one loyalty token" },
  { name: "prepare_loyalty_token_transfer", price: "0.005", description: "ERC-20 transfer calldata; same band as merchant transfer" },
  { name: "list_rewards_for_program", price: "0.01", description: "Redeemable rewards for a program" },
  { name: "list_my_vouchers", price: "0.01", description: "Vouchers for your wallet" },
  { name: "redeem_my_reward", price: "0.01", description: "Redeem reward with transfer tx hash" },
  { name: "list_p2p_offers", price: "0.001", description: "List P2P offers (same band as GET /offers)" },
  { name: "create_p2p_offer", price: "0.01", description: "Create P2P swap intent" },
  { name: "accept_p2p_offer", price: "0.01", description: "Accept a P2P offer" },
  { name: "cancel_p2p_offer", price: "0.005", description: "Cancel your P2P offer" },
];

/**
 * Full pay-per-call price list for AI agents.
 * Source of truth: public/.well-known/mpp.json + _shared/recipient-paid-routes.ts
 * + _shared/recipient-mcp-bazaar-tools.ts. Same prices apply to x402 and MPP gateways
 * (one corridor, two payment rails).
 */

type Row = { method?: string; route: string; price: string; description: string };

const merchantRest: Row[] = [
  { method: "GET", route: "/me", price: "0", description: "Agent profile (free)" },
  { method: "GET", route: "/programs", price: "0.001", description: "List loyalty programs" },
  { method: "GET", route: "/rewards", price: "0.001", description: "List rewards" },
  { method: "GET", route: "/balance", price: "0.001", description: "Check token balance" },
  { method: "GET", route: "/customers", price: "0.002", description: "List customers" },
  { method: "GET", route: "/vouchers", price: "0.001", description: "List vouchers" },
  { method: "GET", route: "/analytics", price: "0.005", description: "Program analytics" },
  { method: "GET", route: "/offers", price: "0.001", description: "List marketplace offers" },
  { method: "GET", route: "/vouchers/status", price: "0", description: "Public voucher status (no key)" },
  { method: "GET", route: "/tx-receipt", price: "0", description: "Extract token_address from deploy tx" },
  { method: "POST", route: "/programs", price: "0.05", description: "Deploy new loyalty token" },
  { method: "POST", route: "/register-program", price: "0.01", description: "Register deployed token" },
  { method: "POST", route: "/update-program-config", price: "0.005", description: "Update cashback / points per dollar" },
  { method: "POST", route: "/activate-program", price: "0.01", description: "Get activation calldata" },
  { method: "POST", route: "/program-status", price: "0.005", description: "Update program status" },
  { method: "POST", route: "/rewards", price: "0.01", description: "Create reward" },
  { method: "POST", route: "/mint", price: "0.01", description: "Mint tokens" },
  { method: "POST", route: "/earn", price: "0.01", description: "Auto-mint cashback from purchase amount" },
  { method: "POST", route: "/transfer", price: "0.005", description: "Transfer tokens" },
  { method: "POST", route: "/redeem-reward", price: "0.01", description: "Redeem reward (verify tx + create voucher)" },
  { method: "POST", route: "/vouchers/use", price: "0.005", description: "Mark voucher as used" },
  { method: "POST", route: "/offers", price: "0.01", description: "Create marketplace offer" },
  { method: "POST", route: "/accept-offer", price: "0.01", description: "Accept offer" },
  { method: "POST", route: "/cancel-offer", price: "0.005", description: "Cancel offer" },
];

const recipientRest: Row[] = (["GET", "POST"] as const).flatMap((method) =>
  Object.entries(RECIPIENT_REST_ROUTE_USD[method] ?? {}).map(([route, price]) => ({
    method,
    route: `/${route.replace(/^recipient-api\//, "")}`,
    price,
    description: descRecipientRest(method, route),
  })),
);

function descRecipientRest(method: string, route: string): string {
  const map: Record<string, string> = {
    "GET recipient-api/me": "Recipient profile",
    "GET recipient-api/balances": "All loyalty balances",
    "GET recipient-api/balance": "One-token balance and tier",
    "GET recipient-api/rewards": "Rewards available to redeem",
    "GET recipient-api/vouchers": "Vouchers for this wallet",
    "GET recipient-api/offers": "P2P marketplace offers",
    "POST recipient-api/register": "Wallet registration after SIWE",
    "POST recipient-api/prepare-transfer": "ERC-20 transfer calldata",
    "POST recipient-api/redeem-reward": "Redeem reward via tx hash",
    "POST recipient-api/offers": "Create P2P swap intent",
    "POST recipient-api/accept-offer": "Accept P2P offer",
    "POST recipient-api/cancel-offer": "Cancel P2P offer",
  };
  return map[`${method} ${route}`] ?? "";
}

const merchantMcpDefault = "0.01";
const merchantMcpOverrides: Record<string, string> = {
  list_marketplace_offers: "0.001",
};
const merchantMcpTools = [
  "get_platform_info", "get_my_profile", "list_loyalty_programs", "create_loyalty_program",
  "register_loyalty_program", "activate_loyalty_program", "update_program_status", "update_program_config",
  "list_rewards", "create_reward", "mint_loyalty_tokens", "transfer_loyalty_tokens", "earn_points",
  "get_token_balance", "get_program_analytics", "list_marketplace_offers", "redeem_reward", "use_voucher",
  "check_voucher_status", "get_platform_stats", "cancel_stale_offers", "create_personalized_offer",
  "update_reward_status", "export_customers", "send_report", "list_my_reports", "update_report_status",
  "delete_report",
];

function PriceTable({ rows, showMethod = true }: { rows: Row[]; showMethod?: boolean }) {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {showMethod && <TableHead className="w-16">Method</TableHead>}
            <TableHead>Route / Tool</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right w-28">USD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.method ?? ""}-${r.route}`}>
              {showMethod && (
                <TableCell>
                  <Badge variant="outline" className="text-[10px] font-mono">{r.method}</Badge>
                </TableCell>
              )}
              <TableCell className="font-mono text-xs">{r.route}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.description}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                {r.price === "0" ? <span className="text-primary">free</span> : `$${r.price}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PayPerCallPriceList() {
  const merchantMcpRows: Row[] = merchantMcpTools.map((name) => ({
    route: name,
    price: merchantMcpOverrides[name] ?? merchantMcpDefault,
    description: "MCP tool",
  }));
  const recipientMcpRows: Row[] = RECIPIENT_MCP_BAZAAR_TOOLS.map((t) => ({
    route: t.name,
    price: t.price,
    description: t.description,
  }));

  return (
    <Card id="full-price-list" className="scroll-mt-20">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Full price list</Badge>
          <Badge variant="outline">x402 · USDC on Base</Badge>
          <Badge variant="outline">MPP · pathUSD/USDC on Tempo</Badge>
        </div>
        <CardTitle className="text-xl mt-2">Pay-per-call — every route & MCP tool</CardTitle>
        <CardDescription>
          Same USD prices apply on both gateways (x402 and MPP). Source: <code className="text-[11px] bg-muted px-1 rounded">public/.well-known/mpp.json</code>{" "}
          and <code className="text-[11px] bg-muted px-1 rounded">_shared/recipient-paid-routes.ts</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="x402">
          <TabsList>
            <TabsTrigger value="x402">x402 (Base USDC)</TabsTrigger>
            <TabsTrigger value="mpp">MPP (Tempo)</TabsTrigger>
          </TabsList>

          {(["x402", "mpp"] as const).map((rail) => (
            <TabsContent key={rail} value={rail} className="space-y-6 mt-4">
              <p className="text-xs text-muted-foreground">
                {rail === "x402"
                  ? "Resource paths via x402-gateway: agent-api/<route>, mcp-tools/<tool>, recipient-api/<route>, recipient-mcp-tools/<tool>."
                  : "Resource paths via mpp-gateway: same routes; settlement in pathUSD or USDC on Tempo."}
              </p>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Merchant REST (lsk_) — 24 routes</h4>
                <PriceTable rows={merchantRest} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Recipient REST (rwk_) — 12 routes</h4>
                <PriceTable rows={recipientRest} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Merchant MCP tools — {merchantMcpTools.length}</h4>
                <PriceTable rows={merchantMcpRows} showMethod={false} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Recipient MCP tools — {recipientMcpRows.length}</h4>
                <PriceTable rows={recipientMcpRows} showMethod={false} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
