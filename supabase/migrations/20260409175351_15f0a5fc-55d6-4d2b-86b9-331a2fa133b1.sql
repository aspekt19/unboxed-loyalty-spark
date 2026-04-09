
-- Table for agent reports/feedback that bridges OpenServ agents with Lovable developer
CREATE TABLE public.agent_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'new',
  action_items JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- RLS: only service_role can write (edge function), authenticated can read
ALTER TABLE public.agent_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent reports"
  ON public.agent_reports FOR SELECT TO authenticated USING (true);

-- Index for quick lookups
CREATE INDEX idx_agent_reports_status ON public.agent_reports(status);
CREATE INDEX idx_agent_reports_created ON public.agent_reports(created_at DESC);
