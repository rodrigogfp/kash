-- Function to calculate user's total balance across all accounts
CREATE OR REPLACE FUNCTION public.calculate_user_total_balance(p_user_id uuid)
RETURNS TABLE (
  total_balance numeric,
  total_available numeric,
  account_count bigint,
  currencies jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ba.current_balance), 0)::numeric as total_balance,
    COALESCE(SUM(ba.available_balance), 0)::numeric as total_available,
    COUNT(DISTINCT ba.id) as account_count,
    jsonb_object_agg(
      ba.currency, 
      COALESCE(SUM(ba.current_balance) FILTER (WHERE ba.currency = ba.currency), 0)
    ) as currencies
  FROM public.bank_connections bc
  JOIN public.bank_accounts ba ON ba.connection_id = bc.id
  WHERE bc.user_id = p_user_id AND bc.status = 'active'
  GROUP BY bc.user_id;
END;
$$;

-- Function to upsert transaction from provider with deduplication
CREATE OR REPLACE FUNCTION public.upsert_transaction_from_provider(
  p_payload jsonb,
  p_connection_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction_id uuid;
  v_account_id uuid;
  v_external_tx_id varchar;
  v_amount numeric;
  v_posted_at timestamptz;
BEGIN
  -- Extract required fields
  v_external_tx_id := p_payload->>'external_transaction_id';
  v_amount := (p_payload->>'amount')::numeric;
  v_posted_at := (p_payload->>'posted_at')::timestamptz;
  
  -- Get account_id from external_account_id
  SELECT id INTO v_account_id
  FROM public.bank_accounts
  WHERE external_account_id = p_payload->>'external_account_id'
    AND connection_id = p_connection_id;
  
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found for external_account_id: %', p_payload->>'external_account_id';
  END IF;
  
  -- Upsert with deduplication
  INSERT INTO public.transactions (
    account_id,
    external_transaction_id,
    amount,
    currency,
    posted_at,
    transaction_date,
    description,
    merchant_name,
    category,
    raw
  ) VALUES (
    v_account_id,
    v_external_tx_id,
    v_amount,
    COALESCE(p_payload->>'currency', 'BRL'),
    v_posted_at,
    (p_payload->>'transaction_date')::date,
    p_payload->>'description',
    p_payload->>'merchant_name',
    p_payload->>'category',
    p_payload->'raw'
  )
  ON CONFLICT (external_transaction_id, account_id) 
  DO UPDATE SET
    amount = EXCLUDED.amount,
    posted_at = EXCLUDED.posted_at,
    description = EXCLUDED.description,
    merchant_name = EXCLUDED.merchant_name,
    raw = EXCLUDED.raw,
    updated_at = now()
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Batch upsert for performance (handles array of transactions)
CREATE OR REPLACE FUNCTION public.upsert_transactions_batch(
  p_transactions jsonb,
  p_connection_id uuid
)
RETURNS TABLE (
  inserted_count int,
  updated_count int,
  error_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx jsonb;
  v_inserted int := 0;
  v_updated int := 0;
  v_errors int := 0;
  v_result uuid;
BEGIN
  -- Use advisory lock to prevent concurrent syncs for same connection
  PERFORM pg_advisory_xact_lock(hashtext(p_connection_id::text));
  
  FOR v_tx IN SELECT jsonb_array_elements(p_transactions)
  LOOP
    BEGIN
      SELECT public.upsert_transaction_from_provider(v_tx, p_connection_id) INTO v_result;
      
      -- Check if it was insert or update based on created_at vs updated_at
      IF EXISTS (
        SELECT 1 FROM public.transactions 
        WHERE id = v_result 
        AND created_at = updated_at
      ) THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Error processing transaction: %', SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_inserted, v_updated, v_errors;
END;
$$;

-- Function to refresh user aggregates with locking
CREATE OR REPLACE FUNCTION public.refresh_user_aggregates(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use advisory lock to prevent concurrent refreshes
  IF p_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('refresh_agg_' || p_user_id::text));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('refresh_agg_global'));
  END IF;
  
  -- Refresh the materialized view concurrently (requires unique index)
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_balances;
END;
$$;

-- Function to get transaction summary by category
CREATE OR REPLACE FUNCTION public.get_spending_by_category(
  p_user_id uuid,
  p_start_date date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category varchar,
  category_id uuid,
  total_amount numeric,
  transaction_count bigint,
  percentage numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric;
BEGIN
  -- Calculate total spending (negative amounts = expenses)
  SELECT COALESCE(SUM(ABS(t.amount)), 0) INTO v_total
  FROM public.transactions t
  JOIN public.bank_accounts ba ON ba.id = t.account_id
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE bc.user_id = p_user_id
    AND t.amount < 0
    AND t.posted_at::date BETWEEN p_start_date AND p_end_date;
  
  RETURN QUERY
  SELECT 
    COALESCE(t.category, 'Outros')::varchar as category,
    t.category_id,
    ABS(SUM(t.amount))::numeric as total_amount,
    COUNT(*)::bigint as transaction_count,
    CASE WHEN v_total > 0 
      THEN ROUND((ABS(SUM(t.amount)) / v_total * 100)::numeric, 2)
      ELSE 0::numeric
    END as percentage
  FROM public.transactions t
  JOIN public.bank_accounts ba ON ba.id = t.account_id
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE bc.user_id = p_user_id
    AND t.amount < 0
    AND t.posted_at::date BETWEEN p_start_date AND p_end_date
  GROUP BY t.category, t.category_id
  ORDER BY total_amount DESC;
END;
$$;

-- Function to get monthly spending trend
CREATE OR REPLACE FUNCTION public.get_monthly_trend(
  p_user_id uuid,
  p_months int DEFAULT 6
)
RETURNS TABLE (
  month date,
  income numeric,
  expenses numeric,
  net numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('month', t.posted_at)::date as month,
    COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0)::numeric as income,
    COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.amount < 0)), 0)::numeric as expenses,
    COALESCE(SUM(t.amount), 0)::numeric as net
  FROM public.transactions t
  JOIN public.bank_accounts ba ON ba.id = t.account_id
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE bc.user_id = p_user_id
    AND t.posted_at >= date_trunc('month', CURRENT_DATE - (p_months || ' months')::interval)
  GROUP BY date_trunc('month', t.posted_at)
  ORDER BY month DESC;
END;
$$;