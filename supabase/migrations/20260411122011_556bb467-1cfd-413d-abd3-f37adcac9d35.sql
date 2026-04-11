UPDATE personalized_offers po
SET is_active = false
WHERE po.is_active = true
  AND po.is_used = false
  AND EXISTS (
    SELECT 1 FROM personalized_offers newer
    WHERE newer.customer_address = po.customer_address
      AND newer.token_address = po.token_address
      AND newer.is_active = true
      AND newer.created_at > po.created_at
  );