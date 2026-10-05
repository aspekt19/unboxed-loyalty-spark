import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeGasAlerts,
  type GasAlert,
  type GasAlertSettings,
  type GasSponsorStatus,
} from "@/lib/gasAlerts";

export type GasSettings = GasAlertSettings & {
  est_sponsored_op_usd: number;
};

export function useGasAlerts() {
  const [settings, setSettings] = useState<GasSettings | null>(null);
  const [status, setStatus] = useState<GasSponsorStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, st] = await Promise.all([
      supabase.from("gas_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.functions.invoke("gas-status"),
    ]);
    if (s) setSettings(s as unknown as GasSettings);
    setStatus((st.data as GasSponsorStatus) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alerts: GasAlert[] = settings ? computeGasAlerts(settings, status) : [];

  return { settings, status, alerts, loading, reload: load, setSettings };
}
