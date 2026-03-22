
CREATE OR REPLACE FUNCTION public.assign_admin_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF LOWER(NEW.wallet_address) = LOWER('0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205')
     OR LOWER(NEW.wallet_address) = LOWER('0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b')
  THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

DELETE FROM public.user_roles
WHERE role = 'admin'
AND user_id IN (
  SELECT user_id FROM public.profiles
  WHERE LOWER(wallet_address) = LOWER('0xf55a2b967ddaa5049f537d8402b791901cc9d34e')
);
