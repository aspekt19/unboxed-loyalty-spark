CREATE OR REPLACE FUNCTION public.generate_certificate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_full text;
  v_exists boolean;
  v_i int;
BEGIN
  LOOP
    v_bytes := extensions.gen_random_bytes(12);
    v_code := '';
    FOR v_i IN 0..11 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % 32) + 1, 1);
      IF v_i IN (3, 7) THEN v_code := v_code || '-'; END IF;
    END LOOP;
    v_full := 'LOYAL-' || v_code;
    SELECT EXISTS(SELECT 1 FROM public.gift_certificates WHERE code = v_full) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_full;
END;
$$;