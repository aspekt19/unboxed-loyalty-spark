import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeGasAlerts,
  type GasAlert,
  type GasAlertSettings,
  type GasWalletStatus,
} from "@/lib/gasAlerts";

export type GasSettings = GasAlertSettings & {
  drip_amount_usd: number;
  drip_cooldown_days: number;
  drip_max_per_month: number;
  est_sponsored_op_usd: number;
};

export function useGasAlerts() {
  const [settings, setSettings] = useState<GasSettings | null>(null);
  const [status, setStatus] = useState<GasWalletStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, st] = await Promise.all([
      supabase.from("gas_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.functions.invoke("gas-drip", { body: { action: "status" } }),
    ]);
    if (s) setSettings(s as unknown as GasSettings);
    setStatus((st.data as GasWalletStatus) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alerts: GasAlert[] = settings ? computeGasAlerts(settings, status) : [];

  return { settings, status, alerts, loading, reload: load, setSettings };
}
