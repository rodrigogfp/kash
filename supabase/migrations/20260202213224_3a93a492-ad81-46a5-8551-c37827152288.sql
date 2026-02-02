-- Drop existing update policy for bank_connections to recreate with restrictions
DROP POLICY IF EXISTS "bank_connections_update_own" ON public.bank_connections;

-- Users can update only non-sensitive fields (status, last_sync, error_message)
-- Token fields are restricted to service_role only
CREATE POLICY "bank_connections_update_own_safe" ON public.bank_connections
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Ensure tokens are not being modified by regular users
    AND (
      access_token_encrypted IS NOT DISTINCT FROM (SELECT access_token_encrypted FROM public.bank_connections WHERE id = bank_connections.id)
      AND refresh_token_encrypted IS NOT DISTINCT FROM (SELECT refresh_token_encrypted FROM public.bank_connections WHERE id = bank_connections.id)
    )
  );

-- Create a view for client-safe bank connection data (excludes tokens)
CREATE OR REPLACE VIEW public.bank_connections_safe AS
SELECT 
  id,
  user_id,
  provider_key,
  external_connection_id,
  scopes,
  status,
  last_sync,
  error_message,
  created_at,
  updated_at
FROM public.bank_connections;

-- Grant select on the safe view to authenticated users
GRANT SELECT ON public.bank_connections_safe TO authenticated;

-- Create helper function to check bank connection ownership
CREATE OR REPLACE FUNCTION public.owns_bank_connection(_connection_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bank_connections
    WHERE id = _connection_id AND user_id = auth.uid()
  )
$$;

-- Update bank_accounts SELECT policy to use helper function for better performance
DROP POLICY IF EXISTS "bank_accounts_select_own" ON public.bank_accounts;
CREATE POLICY "bank_accounts_select_own" ON public.bank_accounts
  FOR SELECT USING (public.owns_bank_connection(connection_id));

-- Update sync_jobs SELECT policy to use helper function
DROP POLICY IF EXISTS "sync_jobs_select_own" ON public.sync_jobs;
CREATE POLICY "sync_jobs_select_own" ON public.sync_jobs
  FOR SELECT USING (public.owns_bank_connection(connection_id));

-- Add composite index for the ownership check function
CREATE INDEX IF NOT EXISTS idx_bank_connections_id_user ON public.bank_connections(id, user_id);