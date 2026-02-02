-- Categories table for transaction categorization
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(100) NOT NULL,
  parent_id uuid NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  icon varchar(50) NULL,
  color varchar(7) NULL,
  is_system boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Categories are readable by all authenticated users
CREATE POLICY "categories_select_authenticated" ON public.categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_all_service" ON public.categories
  FOR ALL USING (is_service_role());

-- Transactions table
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  external_transaction_id varchar(255) NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'BRL',
  posted_at timestamptz NOT NULL,
  transaction_date date NULL,
  description text NULL,
  merchant_name varchar(255) NULL,
  category varchar(100) NULL,
  category_id uuid NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  raw jsonb NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Deduplication constraint
  CONSTRAINT transactions_external_unique UNIQUE (external_transaction_id, account_id)
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions (via bank_accounts ownership)
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT USING (owns_bank_connection(
    (SELECT connection_id FROM public.bank_accounts WHERE id = account_id)
  ));

-- Service role can manage all transactions
CREATE POLICY "transactions_all_service" ON public.transactions
  FOR ALL USING (is_service_role());

-- Performance indexes
CREATE INDEX idx_transactions_account_posted ON public.transactions(account_id, posted_at DESC);
CREATE INDEX idx_transactions_category ON public.transactions(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_transactions_posted_at ON public.transactions(posted_at DESC);
CREATE INDEX idx_transactions_merchant ON public.transactions(merchant_name) WHERE merchant_name IS NOT NULL;

-- Transaction category history (audit trail)
CREATE TABLE public.transaction_categories_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  old_category_id uuid NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  new_category_id uuid NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  old_category_name varchar(100) NULL,
  new_category_name varchar(100) NULL,
  changed_by uuid NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_categories_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own history
CREATE POLICY "tx_history_select_own" ON public.transaction_categories_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.bank_accounts ba ON ba.id = t.account_id
      WHERE t.id = transaction_id AND owns_bank_connection(ba.connection_id)
    )
  );

CREATE POLICY "tx_history_all_service" ON public.transaction_categories_history
  FOR ALL USING (is_service_role());

-- Materialized view for user balances aggregation
CREATE MATERIALIZED VIEW public.user_balances AS
SELECT 
  bc.user_id,
  SUM(COALESCE(ba.current_balance, 0)) as total_balance,
  SUM(COALESCE(ba.available_balance, 0)) as total_available,
  COUNT(DISTINCT ba.id) as account_count,
  MAX(bc.last_sync) as last_sync
FROM public.bank_connections bc
JOIN public.bank_accounts ba ON ba.connection_id = bc.id
WHERE bc.status = 'active'
GROUP BY bc.user_id;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_user_balances_user ON public.user_balances(user_id);

-- Function to refresh user balances
CREATE OR REPLACE FUNCTION public.refresh_user_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_balances;
END;
$$;

-- Trigger to update timestamps
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to log category changes
CREATE OR REPLACE FUNCTION public.log_transaction_category_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.category_id IS DISTINCT FROM NEW.category_id OR OLD.category IS DISTINCT FROM NEW.category THEN
    INSERT INTO public.transaction_categories_history (
      transaction_id, old_category_id, new_category_id, old_category_name, new_category_name
    ) VALUES (
      NEW.id, OLD.category_id, NEW.category_id, OLD.category, NEW.category
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_category_change
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_transaction_category_change();

-- Seed default categories
INSERT INTO public.categories (name, icon, color, is_system) VALUES
  ('Alimentação', 'utensils', '#FF6B6B', true),
  ('Transporte', 'car', '#4ECDC4', true),
  ('Moradia', 'home', '#45B7D1', true),
  ('Saúde', 'heart', '#96CEB4', true),
  ('Educação', 'book', '#FFEAA7', true),
  ('Lazer', 'gamepad-2', '#DDA0DD', true),
  ('Compras', 'shopping-bag', '#98D8C8', true),
  ('Serviços', 'wrench', '#F7DC6F', true),
  ('Transferência', 'arrow-right-left', '#85C1E9', true),
  ('Investimento', 'trending-up', '#82E0AA', true),
  ('Salário', 'wallet', '#5DADE2', true),
  ('Outros', 'circle', '#BDC3C7', true);