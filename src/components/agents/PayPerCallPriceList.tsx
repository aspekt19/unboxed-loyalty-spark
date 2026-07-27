import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MCP_TOOL_COUNT } from "@/constants/mcpToolNames";
import { RECIPIENT_MCP_TOOL_COUNT } from "@/constants/recipientMcpToolNames";

/**
 * Full pay-per-call price list for AI agents.
 *
 * Source of truth (keep in sync):
 * - merchant REST  → supabase/functions/x402-gateway/index.ts PRICING
 * - recipient REST → supabase/functions/_shared/recipient-paid-routes.ts
 * - merchant MCP   → supabase/functions/_shared/mcp-bazaar-tools.ts
 * - recipient MCP  → supabase/functions/_shared/recipient-mcp-bazaar-tools.ts
 *
 * Same USD prices apply on both rails (x402 on Base, MPP on Tempo).
 * The paid x402 corridor exposes a subset of the direct MCP surface
 * ({MCP_TOOL_COUNT} merchant / {RECIPIENT_MCP_TOOL_COUNT} recipient tools).
 */

type Row = { method?: string; route: string; price: string; description: string };

// ---- Merchant REST (lsk_) — mirrors x402-gateway PRICING ------------------
const merchantRest: Row[] = [
  { method: "GET", route: "/me", price: "0", description: "Agent profile (free)" },
  { method: "GET", route: "/programs", price: "0.001", description: "List loyalty programs" },
  { method: "GET", route: "/rewards", price: "0.001", description: "List rewards" },
  { method: "GET", route: "/balance", price: "0.001", description: "Check token balance" },
  { method: "GET", route: "/customers", price: "0.002", description: "List customers" },
  { method: "GET", route: "/vouchers", price: "0.001", description: "List vouchers" },
  { method: "GET", route: "/vouchers/status", price: "0", description: "Public voucher status (no key)" },
  { method: "GET", route: "/analytics", price: "0.005", description: "Program analytics" },
  { method: "GET", route: "/offers", price: "0.001", description: "List marketplace offers" },
  { method: "GET", route: "/tx-receipt", price: "0", description: "Extract token_address from deploy tx" },
  { method: "GET", route: "/merchant-profile", price: "0.001", description: "Read merchant business profile" },
  { method: "GET", route: "/workflow/program-status", price: "0.001", description: "Autonomous program workflow status" },
  { method: "POST", route: "/programs", price: "0.05", description: "Deploy new B20 loyalty token" },
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
  { method: "POST", route: "/merchant-profile", price: "0.005", description: "Create merchant business profile" },
  { method: "POST", route: "/workflow/generate-program-defaults", price: "0.001", description: "Planner: suggested program defaults" },
  { method: "PUT", route: "/merchant-profile", price: "0.005", description: "Update merchant business profile" },
];

// ---- Recipient REST (rwk_) — mirrors _shared/recipient-paid-routes.ts -----
const recipientRest: Row[] = [
  { method: "GET", route: "/me", price: "0", description: "Recipient profile (free)" },
  { method: "GET", route: "/balances", price: "0.001", description: "All loyalty balances" },
  { method: "GET", route: "/balance", price: "0.001", description: "One-token balance and tier" },
  { method: "GET", route: "/rewards", price: "0.001", description: "Rewards available to redeem" },
  { method: "GET", route: "/vouchers", price: "0.001", description: "Vouchers for this wallet" },
  { method: "GET", route: "/offers", price: "0.001", description: "P2P marketplace offers" },
  { method: "GET", route: "/workflow/reward-status", price: "0.001", description: "Planner: reward redemption status" },
  { method: "POST", route: "/register", price: "0", description: "Wallet registration after SIWE (free)" },
  { method: "POST", route: "/prepare-transfer", price: "0.005", description: "Loyalty token transfer calldata" },
  { method: "POST", route: "/redeem-reward", price: "0.01", description: "Redeem reward via tx hash" },
  { method: "POST", route: "/offers", price: "0.01", description: "Create P2P swap intent" },
  { method: "POST", route: "/accept-offer", price: "0.01", description: "Accept P2P offer" },
  { method: "POST", route: "/cancel-offer", price: "0.005", description: "Cancel P2P offer" },
  { method: "POST", route: "/workflow/prepare-reward-redemption", price: "0.005", description: "Planner: one-shot redemption calldata" },
];

// ---- Merchant MCP via x402 (_shared/mcp-bazaar-tools.ts) -----------------
const P = "0.01";
const merchantMcp: Row[] = [
  { route: "get_platform_info", price: P, description: "Protocol metadata on Base L2" },
  { route: "get_my_profile", price: P, description: "Authenticated merchant agent profile" },
  { route: "list_loyalty_programs", price: P, description: "Programs owned by this agent" },
  { route: "create_loyalty_program", price: P, description: "Factory calldata for a new B20 program" },
  { route: "register_loyalty_program", price: P, description: "Register an already-deployed token" },
  { route: "activate_loyalty_program", price: P, description: "Activation calldata" },
  { route: "update_program_status", price: P, description: "Active / paused / archived" },
  { route: "update_program_config", price: P, description: "Cashback rate, points per dollar" },
  { route: "list_rewards", price: P, description: "Rewards catalog with redemption metrics" },
  { route: "create_reward", price: P, description: "Create a redeemable reward" },
  { route: "mint_loyalty_tokens", price: P, description: "Mint + platform fee calldata" },
  { route: "transfer_loyalty_tokens", price: P, description: "Transfer calldata" },
  { route: "earn_points", price: P, description: "Mint cashback from purchase amount" },
  { route: "get_token_balance", price: P, description: "Customer balance and tier" },
  { route: "get_program_analytics", price: P, description: "Holders, mint volume, redemptions" },
  { route: "list_marketplace_offers", price: "0.001", description: "Open P2P swap offers" },
  { route: "redeem_reward", price: P, description: "Redeem reward into a voucher" },
  { route: "use_voucher", price: P, description: "Mark voucher used at checkout" },
  { route: "check_voucher_status", price: P, description: "Look up voucher by code" },
  { route: "get_platform_stats", price: P, description: "Admin-only global stats" },
  { route: "cancel_stale_offers", price: P, description: "Bulk-cancel old P2P offers" },
  { route: "create_personalized_offer", price: P, description: "Targeted retention offer" },
  { route: "update_reward_status", price: P, description: "Activate / deactivate a reward" },
  { route: "send_report", price: P, description: "Submit an agent report" },
  { route: "list_my_reports", price: P, description: "List submitted reports" },
  { route: "update_report_status", price: P, description: "Update report workflow status" },
  { route: "delete_report", price: P, description: "Delete an agent report" },
  { route: "export_customers", price: P, description: "Export customers (CSV/JSON)" },
  { route: "create_gift_certificate", price: P, description: "Issue LOYAL-XXXXXX certificates" },
  { route: "list_gift_certificates", price: P, description: "List issued certificates" },
  { route: "revoke_gift_certificate", price: P, description: "Revoke an active certificate" },
  { route: "mark_gift_certificate_minted", price: P, description: "Finalize claimed certificate after mint" },
  { route: "generate_program_defaults", price: "0.001", description: "Planner: suggested program defaults" },
  { route: "get_program_workflow_status", price: "0.001", description: "Planner: current program step" },
];

// ---- Recipient MCP via x402 (_shared/recipient-mcp-bazaar-tools.ts) ------
const recipientMcp: Row[] = [
  { route: "get_recipient_profile", price: P, description: "Recipient agent profile (rwk_ bound wallet)" },
  { route: "list_my_loyalty_balances", price: P, description: "All loyalty tier balances for your wallet" },
  { route: "get_my_loyalty_balance", price: P, description: "Balance and tier for one loyalty token" },
  { route: "prepare_loyalty_token_transfer", price: "0.005", description: "Holder transfer calldata" },
  { route: "list_rewards_for_program", price: P, description: "Redeemable rewards for a program" },
  { route: "list_my_vouchers", price: P, description: "Vouchers for your wallet" },
  { route: "redeem_my_reward", price: P, description: "Redeem reward with transfer tx hash" },
  { route: "list_p2p_offers", price: "0.001", description: "List P2P offers" },
  { route: "create_p2p_offer", price: P, description: "Create P2P swap intent" },
  { route: "accept_p2p_offer", price: P, description: "Accept a P2P offer" },
  { route: "cancel_p2p_offer", price: "0.005", description: "Cancel your P2P offer" },
  { route: "lookup_gift_certificate", price: P, description: "Preview a certificate by code" },
  { route: "claim_gift_certificate", price: P, description: "Claim an active certificate" },
  { route: "list_my_gift_certificates", price: P, description: "Certificates claimed by your wallet" },
  { route: "get_reward_workflow_status", price: "0.001", description: "Planner: redemption status" },
  { route: "prepare_reward_redemption", price: "0.005", description: "Planner: one-shot redemption calldata" },
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
          Same USD prices apply on both gateways (x402 and MPP). The paid corridor exposes{" "}
          {merchantMcp.length} merchant and {recipientMcp.length} recipient MCP tools; the direct MCP
          servers expose {MCP_TOOL_COUNT} and {RECIPIENT_MCP_TOOL_COUNT} tools respectively
          (Bazaar discovery side-car tools are free over a direct API key).
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
                <h4 className="text-sm font-semibold">Merchant REST (lsk_) — {merchantRest.length} routes</h4>
                <PriceTable rows={merchantRest} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Recipient REST (rwk_) — {recipientRest.length} routes</h4>
                <PriceTable rows={recipientRest} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">
                  Merchant MCP tools — {merchantMcp.length} paid via x402 corridor ({MCP_TOOL_COUNT} on direct MCP)
                </h4>
                <PriceTable rows={merchantMcp} showMethod={false} />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">
                  Recipient MCP tools — {recipientMcp.length} paid via x402 corridor ({RECIPIENT_MCP_TOOL_COUNT} on direct MCP)
                </h4>
                <PriceTable rows={recipientMcp} showMethod={false} />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
