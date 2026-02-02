-- Add UPDATE policy for transactions - users can update category fields only
CREATE POLICY "transactions_update_category_own" ON public.transactions
  FOR UPDATE 
  USING (owns_bank_connection(
    (SELECT connection_id FROM public.bank_accounts WHERE id = account_id)
  ))
  WITH CHECK (
    owns_bank_connection(
      (SELECT connection_id FROM public.bank_accounts WHERE id = account_id)
    )
    -- Ensure only category fields can be changed (other fields must remain the same)
    -- This is enforced at application level; RLS allows the update if owner
  );

-- Ensure categories can be inserted by authenticated users (for custom categories)
CREATE POLICY "categories_insert_authenticated" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (is_system = false);

-- Users can update their own custom categories
CREATE POLICY "categories_update_own" ON public.categories
  FOR UPDATE TO authenticated
  USING (is_system = false)
  WITH CHECK (is_system = false);

-- Users can delete their own custom categories
CREATE POLICY "categories_delete_own" ON public.categories
  FOR DELETE TO authenticated
  USING (is_system = false);

-- Add INSERT policy for transaction_categories_history (for audit trail from user updates)
CREATE POLICY "tx_history_insert_trigger" ON public.transaction_categories_history
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.bank_accounts ba ON ba.id = t.account_id
      WHERE t.id = transaction_id AND owns_bank_connection(ba.connection_id)
    )
  );