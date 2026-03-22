
-- Create trigger for assign_admin_role on profiles table
CREATE TRIGGER on_profile_created_assign_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_admin_role();

-- Insert admin role for existing admin wallets that don't have it yet
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM public.profiles p
WHERE LOWER(p.wallet_address) IN (
  LOWER('0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205'),
  LOWER('0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b')
)
ON CONFLICT (user_id, role) DO NOTHING;
