-- Drop the SECURITY DEFINER view and recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.bank_connections_safe;

-- Recreate the view with SECURITY INVOKER (default, but explicit for clarity)
CREATE VIEW public.bank_connections_safe 
WITH (security_invoker = true)
AS
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

-- Re-grant select on the safe view to authenticated users
GRANT SELECT ON public.bank_connections_safe TO authenticated;