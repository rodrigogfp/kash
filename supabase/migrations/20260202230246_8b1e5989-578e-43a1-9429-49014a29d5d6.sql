-- Revoke API access from materialized view (security fix)
REVOKE ALL ON public.user_balances FROM anon, authenticated;

-- Create a secure function to access user balances instead
CREATE OR REPLACE FUNCTION public.get_user_balance(user_uuid uuid DEFAULT auth.uid())
RETURNS TABLE (
  user_id uuid,
  total_balance numeric,
  total_available numeric,
  account_count bigint,
  last_sync timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow users to see their own balances
  IF user_uuid != auth.uid() AND NOT is_service_role() THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    bc.user_id,
    SUM(COALESCE(ba.current_balance, 0))::numeric as total_balance,
    SUM(COALESCE(ba.available_balance, 0))::numeric as total_available,
    COUNT(DISTINCT ba.id) as account_count,
    MAX(bc.last_sync) as last_sync
  FROM public.bank_connections bc
  JOIN public.bank_accounts ba ON ba.connection_id = bc.id
  WHERE bc.status = 'active' AND bc.user_id = user_uuid
  GROUP BY bc.user_id;
END;
$$;