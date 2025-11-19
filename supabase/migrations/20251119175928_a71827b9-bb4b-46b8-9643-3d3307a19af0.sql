-- Create automation_rules table
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'at_risk_offer', 'tier_upgrade', 'voucher_expiring', 'inactive_reminder', 'birthday_bonus'
  is_active BOOLEAN DEFAULT true,
  trigger_condition JSONB NOT NULL, -- conditions for triggering the rule
  action_config JSONB NOT NULL, -- action to perform when triggered
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create automation_triggers_history table
CREATE TABLE public.automation_triggers_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
  merchant_address TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  action_taken TEXT NOT NULL,
  result JSONB, -- result of the action
  success BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_triggers_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_rules
CREATE POLICY "Merchants can manage own automation rules"
ON public.automation_rules
FOR ALL
USING (merchant_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (merchant_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for automation_triggers_history
CREATE POLICY "Merchants can view own trigger history"
ON public.automation_triggers_history
FOR SELECT
USING (merchant_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can insert trigger history"
ON public.automation_triggers_history
FOR INSERT
WITH CHECK (true);

-- Create updated_at trigger for automation_rules
CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_automation_rules_merchant ON automation_rules(merchant_address);
CREATE INDEX idx_automation_rules_active ON automation_rules(is_active);
CREATE INDEX idx_automation_triggers_rule ON automation_triggers_history(rule_id);
CREATE INDEX idx_automation_triggers_merchant ON automation_triggers_history(merchant_address);
CREATE INDEX idx_automation_triggers_triggered_at ON automation_triggers_history(triggered_at DESC);