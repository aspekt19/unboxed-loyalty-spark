-- Create function to auto-assign admin role for specific wallet
CREATE OR REPLACE FUNCTION public.assign_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the admin wallet
  IF LOWER(NEW.wallet_address) = LOWER('0xf55a2b967ddaa5049f537d8402b791901cc9d34e') THEN
    -- Insert admin role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS assign_admin_role_trigger ON public.profiles;
CREATE TRIGGER assign_admin_role_trigger
  AFTER INSERT OR UPDATE OF wallet_address ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_admin_role();