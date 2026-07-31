-- identity_links: reads only; all writes go through SECURITY DEFINER functions
REVOKE ALL ON public.identity_links FROM anon;
REVOKE ALL ON public.identity_links FROM authenticated;
GRANT SELECT ON public.identity_links TO authenticated;
GRANT ALL ON public.identity_links TO service_role;

-- plan subscriptions: owners may read and create pending rows only
REVOKE ALL ON public.merchant_plan_subscriptions FROM anon;
REVOKE ALL ON public.merchant_plan_subscriptions FROM authenticated;
GRANT SELECT, INSERT ON public.merchant_plan_subscriptions TO authenticated;
GRANT ALL ON public.merchant_plan_subscriptions TO service_role;

REVOKE ALL ON public.agent_plan_subscriptions FROM anon;
REVOKE ALL ON public.agent_plan_subscriptions FROM authenticated;
GRANT SELECT, INSERT ON public.agent_plan_subscriptions TO authenticated;
GRANT ALL ON public.agent_plan_subscriptions TO service_role;