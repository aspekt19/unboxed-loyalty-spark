CREATE TABLE public.notify_me_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notify_me_signups_email_unique ON public.notify_me_signups (lower(email));

ALTER TABLE public.notify_me_signups ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can insert their email
CREATE POLICY "Anyone can sign up for notifications"
  ON public.notify_me_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- Only admins can read the list
CREATE POLICY "Admins can view all signups"
  ON public.notify_me_signups
  FOR SELECT
  TO authenticated
  USING (public.is_admin());