import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useGasAlerts, type GasSettings } from "@/hooks/useGasAlerts";

type Top = { wallet: string; usd: number };

export function GasBudgetManagement() {
  const { settings: s, status, reload, setSettings } = useGasAlerts();
  const [counts, setCounts] = useState({ ops: 0, drips: 0 });
  const [top, setTop] = useState<Top[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const since = monthStart.toISOString();
    const [, ops, drips] = await Promise.all([
      reload(),
      supabase.from("gas_sponsorships").select("wallet_address, est_cost_usd").gte("created_at", since).limit(5000),
      supabase.from("gas_drips").select("wallet_address, amount_usd").eq("status", "sent").gte("created_at", since).limit(5000),
    ]);
    const per = new Map<string, number>();
    for (const r of ops.data ?? []) per.set(r.wallet_address, (per.get(r.wallet_address) ?? 0) + Number(r.est_cost_usd ?? 0));
    for (const r of drips.data ?? []) per.set(r.wallet_address, (per.get(r.wallet_address) ?? 0) + Number(r.amount_usd ?? 0));
    setCounts({ ops: ops.data?.length ?? 0, drips: drips.data?.length ?? 0 });
    setTop([...per.entries()].map(([wallet, usd]) => ({ wallet, usd })).sort((a, b) => b.usd - a.usd).slice(0, 5));
  };

  useEffect(() => { load(); }, []);

  const save = async (patch: Partial<GasSettings>) => {
    if (!s) return;
    const next = { ...s, ...patch };
    setSettings(next);
    setSaving(true);
    const { error } = await supabase.from("gas_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (error) toast.error("Could not save: " + error.message); else toast.success("Saved");
  };

  if (!s) return <p className="text-muted-foreground text-sm">Loading…</p>;
  const spent = status?.spent_usd ?? 0;
  const pct = s.monthly_budget_usd > 0 ? Math.min(100, (spent / s.monthly_budget_usd) * 100) : 100;
  const walletUsd = status?.balance_eth ? Number(status.balance_eth) * (status.eth_usd || 0) : null;

  const num = (key: keyof Settings, label: string, step = "0.01") => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type="number" step={step} min="0" defaultValue={String(s[key])}
        onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== s[key]) save({ [key]: v } as Partial<Settings>); }} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gas budget this month</CardTitle>
          <CardDescription>Shared by smart-wallet sponsorship and gas top-ups. Resets on the 1st (UTC).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm"><span>Spent ${spent.toFixed(2)}</span><span>Remaining ${Math.max(0, s.monthly_budget_usd - spent).toFixed(2)}</span></div>
          <Progress value={pct} />
          <div className="text-sm text-muted-foreground">{counts.ops} sponsored actions · {counts.drips} top-ups</div>
          <div className="grid sm:grid-cols-2 gap-4">{num("monthly_budget_usd", "Monthly budget (USD)", "1")}</div>
          {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sw">Free gas for smart wallets</Label>
            <Switch id="sw" checked={s.sponsor_smart_wallets} onCheckedChange={(v) => save({ sponsor_smart_wallets: v })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="dr">Gas top-ups for other wallets</Label>
            <Switch id="dr" checked={s.drip_enabled} onCheckedChange={(v) => save({ drip_enabled: v })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {num("drip_amount_usd", "Top-up size (USD)")}
            {num("drip_cooldown_days", "Days between top-ups per wallet", "1")}
            {num("drip_max_per_month", "Max top-ups per wallet per month", "1")}
            {num("est_sponsored_op_usd", "Estimated cost per sponsored action (USD)", "0.001")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gas wallet</CardTitle>
          <CardDescription>Send ETH on Base to this address to fund top-ups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {status?.gas_wallet ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all">{status.gas_wallet}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(status.gas_wallet!); toast.success("Copied"); }}>Copy</Button>
              </div>
              <div>Balance: {status.balance_eth ?? "—"} ETH{walletUsd !== null ? ` (~$${walletUsd.toFixed(2)})` : ""}</div>
            </>
          ) : <p className="text-muted-foreground">Gas wallet not connected yet — top-ups are off until it is.</p>}
          <div className="text-muted-foreground">Smart-wallet sponsorship: {status?.paymaster_configured ? "connected" : "not connected"}</div>
        </CardContent>
      </Card>

      {top.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Top consumers this month</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {top.map((t) => (
              <div key={t.wallet} className="flex justify-between gap-2"><code className="truncate">{t.wallet}</code><span>${t.usd.toFixed(2)}</span></div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
