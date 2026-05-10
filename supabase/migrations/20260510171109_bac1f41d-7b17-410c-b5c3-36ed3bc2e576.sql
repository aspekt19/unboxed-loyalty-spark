CREATE OR REPLACE FUNCTION public.generate_certificate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_full text;
  v_exists boolean;
  v_i int;
BEGIN
  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || floor(random() * 10)::int::text;
    END LOOP;
    v_full := 'LOYAL-' || v_code;
    SELECT EXISTS(SELECT 1 FROM public.gift_certificates WHERE code = v_full) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_full;
END;
$$;