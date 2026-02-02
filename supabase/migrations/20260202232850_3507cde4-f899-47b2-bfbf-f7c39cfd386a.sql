-- Add auto_rules to categories table
ALTER TABLE public.categories
ADD COLUMN auto_rules jsonb DEFAULT '[]'::jsonb;

-- Create analytics_snapshots table for cached period analytics
CREATE TABLE public.analytics_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_type varchar(20) NOT NULL DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly', 'yearly'
  period_start date NOT NULL,
  period_end date NOT NULL,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb, -- category_id -> { amount, count, currency }
  income numeric NOT NULL DEFAULT 0,
  expenses numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'BRL',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_type, period_start, currency)
);

-- Create period_comparisons table for cached comparison metrics
CREATE TABLE public.period_comparisons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_key varchar(50) NOT NULL, -- e.g., '2026-01_vs_2025-12', 'current_month_vs_last'
  base_period_start date NOT NULL,
  base_period_end date NOT NULL,
  compare_period_start date NOT NULL,
  compare_period_end date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb, -- { income_change_pct, expenses_change_pct, by_category: {...} }
  currency varchar(3) NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz, -- for cache invalidation
  UNIQUE(user_id, period_key, currency)
);

-- Create indexes for performance
CREATE INDEX idx_analytics_snapshots_user_period ON public.analytics_snapshots(user_id, period_start DESC);
CREATE INDEX idx_analytics_snapshots_period_type ON public.analytics_snapshots(user_id, period_type, period_start DESC);
CREATE INDEX idx_period_comparisons_user_key ON public.period_comparisons(user_id, period_key);
CREATE INDEX idx_period_comparisons_expires ON public.period_comparisons(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_comparisons ENABLE ROW LEVEL SECURITY;

-- RLS policies for analytics_snapshots
CREATE POLICY "analytics_snapshots_select_own" ON public.analytics_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "analytics_snapshots_all_service" ON public.analytics_snapshots
  FOR ALL USING (is_service_role());

-- RLS policies for period_comparisons
CREATE POLICY "period_comparisons_select_own" ON public.period_comparisons
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "period_comparisons_all_service" ON public.period_comparisons
  FOR ALL USING (is_service_role());

-- Add updated_at trigger
CREATE TRIGGER update_analytics_snapshots_updated_at
  BEFORE UPDATE ON public.analytics_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to compute and cache monthly analytics snapshot
CREATE OR REPLACE FUNCTION public.compute_monthly_snapshot(
  p_user_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  p_month int DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int,
  p_currency varchar DEFAULT 'BRL'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start date;
  v_period_end date;
  v_snapshot_id uuid;
  v_totals jsonb;
  v_income numeric;
  v_expenses numeric;
BEGIN
  -- Calculate period bounds
  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  
  -- Aggregate spending by category
  SELECT 
    COALESCE(
      jsonb_object_agg(
        COALESCE(category_id::text, 'uncategorized'),
        jsonb_build_object(
          'amount', total_amount,
          'count', tx_count,
          'category_name', category_name
        )
      ),
      '{}'::jsonb
    ),
    COALESCE(SUM(total_amount) FILTER (WHERE total_amount > 0), 0),
    COALESCE(ABS(SUM(total_amount) FILTER (WHERE total_amount < 0)), 0)
  INTO v_totals, v_income, v_expenses
  FROM (
    SELECT 
      t.category_id,
      COALESCE(t.category, 'Outros') as category_name,
      SUM(t.amount) as total_amount,
      COUNT(*) as tx_count
    FROM public.transactions t
    JOIN public.bank_accounts ba ON ba.id = t.account_id
    JOIN public.bank_connections bc ON bc.id = ba.connection_id
    WHERE bc.user_id = p_user_id
      AND t.currency = p_currency
      AND t.posted_at::date BETWEEN v_period_start AND v_period_end
    GROUP BY t.category_id, t.category
  ) sub;
  
  -- Upsert snapshot
  INSERT INTO public.analytics_snapshots (
    user_id, period_type, period_start, period_end,
    totals, income, expenses, net, currency
  ) VALUES (
    p_user_id, 'monthly', v_period_start, v_period_end,
    v_totals, v_income, v_expenses, (v_income - v_expenses), p_currency
  )
  ON CONFLICT (user_id, period_type, period_start, currency)
  DO UPDATE SET
    totals = EXCLUDED.totals,
    income = EXCLUDED.income,
    expenses = EXCLUDED.expenses,
    net = EXCLUDED.net,
    updated_at = now()
  RETURNING id INTO v_snapshot_id;
  
  RETURN v_snapshot_id;
END;
$$;

-- Function to compute period comparison
CREATE OR REPLACE FUNCTION public.compute_period_comparison(
  p_user_id uuid,
  p_base_start date,
  p_base_end date,
  p_compare_start date,
  p_compare_end date,
  p_currency varchar DEFAULT 'BRL'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_income numeric;
  v_base_expenses numeric;
  v_compare_income numeric;
  v_compare_expenses numeric;
  v_base_by_category jsonb;
  v_compare_by_category jsonb;
  v_result jsonb;
BEGIN
  -- Base period aggregates
  SELECT 
    COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0),
    COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.amount < 0)), 0)
  INTO v_base_income, v_base_expenses
  FROM public.transactions t
  JOIN public.bank_accounts ba ON ba.id = t.account_id
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE bc.user_id = p_user_id
    AND t.currency = p_currency
    AND t.posted_at::date BETWEEN p_base_start AND p_base_end;
  
  -- Compare period aggregates
  SELECT 
    COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0),
    COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.amount < 0)), 0)
  INTO v_compare_income, v_compare_expenses
  FROM public.transactions t
  JOIN public.bank_accounts ba ON ba.id = t.account_id
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE bc.user_id = p_user_id
    AND t.currency = p_currency
    AND t.posted_at::date BETWEEN p_compare_start AND p_compare_end;
  
  -- Build result
  v_result := jsonb_build_object(
    'base_period', jsonb_build_object(
      'start', p_base_start,
      'end', p_base_end,
      'income', v_base_income,
      'expenses', v_base_expenses,
      'net', v_base_income - v_base_expenses
    ),
    'compare_period', jsonb_build_object(
      'start', p_compare_start,
      'end', p_compare_end,
      'income', v_compare_income,
      'expenses', v_compare_expenses,
      'net', v_compare_income - v_compare_expenses
    ),
    'changes', jsonb_build_object(
      'income_diff', v_base_income - v_compare_income,
      'income_pct', CASE WHEN v_compare_income > 0 
        THEN ROUND(((v_base_income - v_compare_income) / v_compare_income * 100)::numeric, 2)
        ELSE NULL END,
      'expenses_diff', v_base_expenses - v_compare_expenses,
      'expenses_pct', CASE WHEN v_compare_expenses > 0
        THEN ROUND(((v_base_expenses - v_compare_expenses) / v_compare_expenses * 100)::numeric, 2)
        ELSE NULL END
    )
  );
  
  RETURN v_result;
END;
$$;

-- Function to get or compute analytics (on-demand with caching)
CREATE OR REPLACE FUNCTION public.get_monthly_analytics(
  p_user_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  p_month int DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int,
  p_force_refresh boolean DEFAULT false
)
RETURNS TABLE (
  snapshot_id uuid,
  period_start date,
  period_end date,
  totals jsonb,
  income numeric,
  expenses numeric,
  net numeric,
  is_cached boolean,
  cached_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start date;
  v_snapshot record;
  v_cache_age interval;
BEGIN
  v_period_start := make_date(p_year, p_month, 1);
  
  -- Check for existing snapshot
  SELECT * INTO v_snapshot
  FROM public.analytics_snapshots
  WHERE user_id = p_user_id
    AND period_type = 'monthly'
    AND analytics_snapshots.period_start = v_period_start
    AND currency = 'BRL';
  
  -- Calculate cache age
  IF v_snapshot IS NOT NULL THEN
    v_cache_age := now() - v_snapshot.updated_at;
  END IF;
  
  -- Return cached if fresh (less than 1 hour for current month, unlimited for past)
  IF v_snapshot IS NOT NULL 
     AND NOT p_force_refresh
     AND (
       v_period_start < date_trunc('month', CURRENT_DATE)::date -- past month, always cached
       OR v_cache_age < INTERVAL '1 hour' -- current month, cache for 1 hour
     )
  THEN
    RETURN QUERY SELECT 
      v_snapshot.id,
      v_snapshot.period_start,
      v_snapshot.period_end,
      v_snapshot.totals,
      v_snapshot.income,
      v_snapshot.expenses,
      v_snapshot.net,
      true as is_cached,
      v_snapshot.updated_at as cached_at;
    RETURN;
  END IF;
  
  -- Compute fresh snapshot
  PERFORM public.compute_monthly_snapshot(p_user_id, p_year, p_month);
  
  -- Return fresh data
  RETURN QUERY SELECT 
    s.id,
    s.period_start,
    s.period_end,
    s.totals,
    s.income,
    s.expenses,
    s.net,
    false as is_cached,
    s.updated_at as cached_at
  FROM public.analytics_snapshots s
  WHERE s.user_id = p_user_id
    AND s.period_type = 'monthly'
    AND s.period_start = v_period_start
    AND s.currency = 'BRL';
END;
$$;