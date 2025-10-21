-- Drop the old policy for public viewing
DROP POLICY IF EXISTS "Anyone can view active programs" ON loyalty_programs;

-- Create updated policy that includes paused programs but excludes expired
CREATE POLICY "Anyone can view active programs"
ON loyalty_programs
FOR SELECT
USING (
  status IN ('active', 'expiring_soon', 'paused')
);

-- Update merchant policy to exclude expired programs
DROP POLICY IF EXISTS "Merchants can view all own programs" ON loyalty_programs;

CREATE POLICY "Merchants can view all own programs"
ON loyalty_programs
FOR SELECT
USING (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
  AND status != 'expired'
);