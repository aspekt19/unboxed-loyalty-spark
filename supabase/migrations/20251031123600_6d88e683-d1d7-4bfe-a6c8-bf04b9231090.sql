-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated merchants can create rewards" ON rewards;

-- Recreate INSERT policy with case-insensitive comparison
CREATE POLICY "Authenticated merchants can create rewards"
ON rewards
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND LOWER(merchant_address) = (
    SELECT LOWER(wallet_address)
    FROM profiles
    WHERE user_id = auth.uid()
  )
);

-- Also update the DELETE policy for consistency
DROP POLICY IF EXISTS "Merchants can delete own rewards" ON rewards;

CREATE POLICY "Merchants can delete own rewards"
ON rewards
FOR DELETE
TO public
USING (
  LOWER(merchant_address) = (
    SELECT LOWER(wallet_address)
    FROM profiles
    WHERE user_id = auth.uid()
  )
);

-- Update the UPDATE policy for consistency
DROP POLICY IF EXISTS "Merchants can update own rewards" ON rewards;

CREATE POLICY "Merchants can update own rewards"
ON rewards
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = auth.uid()
    AND LOWER(wallet_address) = LOWER(merchant_address)
  )
);