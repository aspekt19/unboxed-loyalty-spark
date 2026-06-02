CREATE UNIQUE INDEX IF NOT EXISTS agent_plan_subscriptions_tx_hash_uniq
  ON public.agent_plan_subscriptions (lower(transaction_hash))
  WHERE transaction_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS merchant_plan_subscriptions_tx_hash_uniq
  ON public.merchant_plan_subscriptions (lower(transaction_hash))
  WHERE transaction_hash IS NOT NULL;