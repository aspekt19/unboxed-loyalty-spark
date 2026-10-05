import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useGasAlerts, type GasSettings } from "@/hooks/useGasAlerts";

type Top = { wallet: string; usd: number };

export function GasBudgetManagement() {
  const { settings: s, status, reload, setSettings } = useGasAlerts();
  const [opCount, setOpCount] = useState(0);
  const [top, setTop] = useState<Top[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const since = monthStart.toISOString();
    const [, ops] = await Promise.all([
      reload(),
      supabase.from("gas_sponsorships").select("wallet_address, est_cost_usd").gte("created_at", since).limit(5000),
    ]);
    const per = new Map<string, number>();
    for (const r of ops.data ?? []) per.set(r.wallet_address, (per.get(r.wallet_address) ?? 0) + Number(r.est_cost_usd ?? 0));
    setOpCount(ops.data?.length ?? 0);
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

  const num = (key: keyof GasSettings, label: string, step = "0.01") => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type="number" step={step} min="0" defaultValue={String(s[key])}
        onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== s[key]) save({ [key]: v } as Partial<GasSettings>); }} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gas budget this month</CardTitle>
          <CardDescription>Covers free gas for smart-wallet users. Resets on the 1st (UTC).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm"><span>Spent ${spent.toFixed(2)}</span><span>Remaining ${Math.max(0, s.monthly_budget_usd - spent).toFixed(2)}</span></div>
          <Progress value={pct} />
          <div className="text-sm text-muted-foreground">{opCount} sponsored actions</div>
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
          <div className="grid sm:grid-cols-2 gap-4">
            {num("est_sponsored_op_usd", "Estimated cost per sponsored action (USD)", "0.001")}
            {num("budget_warn_percent", "Warn when budget used (%)", "1")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sponsorship connection</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Smart-wallet sponsorship: {status?.paymaster_configured ? "connected" : "not connected"}
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
