-- =============================================
-- Fix: Restrict transaction updates to category fields only
-- =============================================
-- The current policy allows users to update ANY field on transactions they own.
-- This creates a security risk where users could modify amount, date, or other
-- immutable fields that should only be set by the sync process.

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "transactions_update_category_own" ON public.transactions;

-- Create a more restrictive policy that only allows category field updates
-- by verifying that immutable fields remain unchanged
CREATE POLICY "transactions_update_category_own" ON public.transactions
  FOR UPDATE 
  USING (
    owns_bank_connection((
      SELECT ba.connection_id 
      FROM public.bank_accounts ba 
      WHERE ba.id = transactions.account_id
    ))
  )
  WITH CHECK (
    owns_bank_connection((
      SELECT ba.connection_id 
      FROM public.bank_accounts ba 
      WHERE ba.id = transactions.account_id
    ))
    -- Enforce field-level restrictions at database level
    -- Only category and category_id can be changed by users
    -- All other fields must remain unchanged
    AND amount = (SELECT t.amount FROM public.transactions t WHERE t.id = transactions.id)
    AND posted_at = (SELECT t.posted_at FROM public.transactions t WHERE t.id = transactions.id)
    AND external_transaction_id = (SELECT t.external_transaction_id FROM public.transactions t WHERE t.id = transactions.id)
    AND account_id = (SELECT t.account_id FROM public.transactions t WHERE t.id = transactions.id)
    AND currency = (SELECT t.currency FROM public.transactions t WHERE t.id = transactions.id)
    AND imported_at = (SELECT t.imported_at FROM public.transactions t WHERE t.id = transactions.id)
    AND raw = (SELECT t.raw FROM public.transactions t WHERE t.id = transactions.id)
    AND transaction_date IS NOT DISTINCT FROM (SELECT t.transaction_date FROM public.transactions t WHERE t.id = transactions.id)
    -- description and merchant_name can optionally be updated for user corrections
  );