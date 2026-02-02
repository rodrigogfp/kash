-- Create index on transactions(posted_at) for query performance
CREATE INDEX IF NOT EXISTS idx_transactions_posted_at ON public.transactions(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_posted ON public.transactions(account_id, posted_at DESC);

-- Create goals table for savings goals tracking
CREATE TABLE public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'BRL',
  deadline date,
  category varchar(50), -- 'savings', 'debt_payoff', 'purchase', 'emergency_fund'
  status varchar(20) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'paused', 'cancelled'
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Goal contributions tracking
CREATE TABLE public.goal_contributions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  note text,
  contributed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for goals
CREATE INDEX idx_goals_user_status ON public.goals(user_id, status);
CREATE INDEX idx_goal_contributions_goal ON public.goal_contributions(goal_id, contributed_at DESC);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

-- Helper function to check goal ownership
CREATE OR REPLACE FUNCTION public.owns_goal(_goal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.goals
    WHERE id = _goal_id AND user_id = auth.uid()
  )
$$;

-- RLS policies for goals
CREATE POLICY "goals_select_own" ON public.goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "goals_insert_own" ON public.goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own" ON public.goals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_delete_own" ON public.goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "goals_all_service" ON public.goals
  FOR ALL USING (is_service_role());

-- RLS policies for goal_contributions
CREATE POLICY "goal_contributions_select_own" ON public.goal_contributions
  FOR SELECT USING (owns_goal(goal_id));

CREATE POLICY "goal_contributions_insert_own" ON public.goal_contributions
  FOR INSERT WITH CHECK (owns_goal(goal_id));

CREATE POLICY "goal_contributions_delete_own" ON public.goal_contributions
  FOR DELETE USING (owns_goal(goal_id));

CREATE POLICY "goal_contributions_all_service" ON public.goal_contributions
  FOR ALL USING (is_service_role());

-- Updated_at trigger
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function: compute_period_totals
-- Returns aggregated transaction totals by category for a date range
CREATE OR REPLACE FUNCTION public.compute_period_totals(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_currency varchar DEFAULT 'BRL'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date,
      'days', p_end_date - p_start_date + 1
    ),
    'summary', jsonb_build_object(
      'total_income', COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0),
      'total_expenses', COALESCE(ABS(SUM(t.amount) FILTER (WHERE t.amount < 0)), 0),
      'net', COALESCE(SUM(t.amount), 0),
      'transaction_count', COUNT(*)
    ),
    'by_category', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'category_id', cat_data.category_id,
          'category_name', cat_data.category_name,
          'total_amount', cat_data.total_amount,
          'transaction_count', cat_data.tx_count,
          'avg_transaction', cat_data.avg_amount,
          'percentage', ROUND(
            (ABS(cat_data.total_amount) / NULLIF(cat_data.total_expenses, 0) * 100)::numeric, 2
          )
        )
      ) FILTER (WHERE cat_data.category_id IS NOT NULL OR cat_data.category_name IS NOT NULL),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.transactions t
  JOIN public.bank_accounts ba ON ba.id = t.account_id
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  LEFT JOIN LATERAL (
    SELECT 
      t2.category_id,
      COALESCE(t2.category, 'Outros') as category_name,
      SUM(t2.amount) as total_amount,
      COUNT(*) as tx_count,
      AVG(t2.amount) as avg_amount,
      (
        SELECT ABS(SUM(t3.amount))
        FROM public.transactions t3
        JOIN public.bank_accounts ba3 ON ba3.id = t3.account_id
        JOIN public.bank_connections bc3 ON bc3.id = ba3.connection_id
        WHERE bc3.user_id = p_user_id
          AND t3.currency = p_currency
          AND t3.amount < 0
          AND t3.posted_at::date BETWEEN p_start_date AND p_end_date
      ) as total_expenses
    FROM public.transactions t2
    JOIN public.bank_accounts ba2 ON ba2.id = t2.account_id
    JOIN public.bank_connections bc2 ON bc2.id = ba2.connection_id
    WHERE bc2.user_id = p_user_id
      AND t2.currency = p_currency
      AND t2.amount < 0
      AND t2.posted_at::date BETWEEN p_start_date AND p_end_date
    GROUP BY t2.category_id, t2.category
  ) cat_data ON true
  WHERE bc.user_id = p_user_id
    AND t.currency = p_currency
    AND t.posted_at::date BETWEEN p_start_date AND p_end_date;
  
  RETURN COALESCE(v_result, jsonb_build_object(
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date, 'days', p_end_date - p_start_date + 1),
    'summary', jsonb_build_object('total_income', 0, 'total_expenses', 0, 'net', 0, 'transaction_count', 0),
    'by_category', '[]'::jsonb
  ));
END;
$$;

-- Simpler version of compute_period_totals for better performance
CREATE OR REPLACE FUNCTION public.get_period_summary(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_currency varchar DEFAULT 'BRL'
)
RETURNS TABLE (
  total_income numeric,
  total_expenses numeric,
  net numeric,
  transaction_count bigint,
  by_category jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH tx_data AS (
    SELECT 
      t.category_id,
      COALESCE(t.category, 'Outros') as category_name,
      t.amount
    FROM public.transactions t
    JOIN public.bank_accounts ba ON ba.id = t.account_id
    JOIN public.bank_connections bc ON bc.id = ba.connection_id
    WHERE bc.user_id = p_user_id
      AND t.currency = p_currency
      AND t.posted_at::date BETWEEN p_start_date AND p_end_date
  ),
  totals AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) as income,
      COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0)), 0) as expenses,
      COALESCE(SUM(amount), 0) as net_total,
      COUNT(*) as tx_count
    FROM tx_data
  ),
  categories AS (
    SELECT 
      category_id,
      category_name,
      ABS(SUM(amount)) as cat_total,
      COUNT(*) as cat_count
    FROM tx_data
    WHERE amount < 0
    GROUP BY category_id, category_name
  )
  SELECT 
    t.income,
    t.expenses,
    t.net_total,
    t.tx_count,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'category_id', c.category_id,
            'category_name', c.category_name,
            'amount', c.cat_total,
            'count', c.cat_count,
            'percentage', ROUND((c.cat_total / NULLIF(t.expenses, 0) * 100)::numeric, 2)
          )
          ORDER BY c.cat_total DESC
        )
        FROM categories c
      ),
      '[]'::jsonb
    )
  FROM totals t;
END;
$$;

-- Function: predict_goal_completion
-- Uses historical contribution patterns to predict when a goal will be completed
CREATE OR REPLACE FUNCTION public.predict_goal_completion(
  p_user_id uuid,
  p_goal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal record;
  v_avg_monthly_contribution numeric;
  v_avg_monthly_savings numeric;
  v_remaining_amount numeric;
  v_months_to_complete numeric;
  v_predicted_date date;
  v_confidence varchar;
  v_contribution_count int;
BEGIN
  -- Get goal details
  SELECT * INTO v_goal
  FROM public.goals
  WHERE id = p_goal_id AND user_id = p_user_id;
  
  IF v_goal IS NULL THEN
    RETURN jsonb_build_object('error', 'Goal not found');
  END IF;
  
  IF v_goal.status = 'completed' THEN
    RETURN jsonb_build_object(
      'goal_id', p_goal_id,
      'status', 'completed',
      'completed_at', v_goal.updated_at
    );
  END IF;
  
  v_remaining_amount := v_goal.target_amount - v_goal.current_amount;
  
  IF v_remaining_amount <= 0 THEN
    RETURN jsonb_build_object(
      'goal_id', p_goal_id,
      'status', 'completed',
      'message', 'Goal already reached'
    );
  END IF;
  
  -- Calculate average monthly contribution from goal_contributions
  SELECT 
    COALESCE(SUM(gc.amount) / NULLIF(
      EXTRACT(MONTH FROM AGE(now(), MIN(gc.contributed_at))) + 1, 0
    ), 0),
    COUNT(*)
  INTO v_avg_monthly_contribution, v_contribution_count
  FROM public.goal_contributions gc
  WHERE gc.goal_id = p_goal_id
    AND gc.contributed_at > now() - INTERVAL '6 months';
  
  -- If no contributions, try to estimate from user's net savings
  IF v_avg_monthly_contribution <= 0 OR v_contribution_count < 2 THEN
    SELECT COALESCE(AVG(monthly_net), 0)
    INTO v_avg_monthly_savings
    FROM (
      SELECT 
        date_trunc('month', t.posted_at) as month,
        SUM(t.amount) as monthly_net
      FROM public.transactions t
      JOIN public.bank_accounts ba ON ba.id = t.account_id
      JOIN public.bank_connections bc ON bc.id = ba.connection_id
      WHERE bc.user_id = p_user_id
        AND t.posted_at > now() - INTERVAL '6 months'
      GROUP BY date_trunc('month', t.posted_at)
    ) monthly_data
    WHERE monthly_net > 0; -- Only consider months with positive savings
    
    -- Use 20% of net savings as potential contribution
    v_avg_monthly_contribution := GREATEST(v_avg_monthly_contribution, v_avg_monthly_savings * 0.2);
    v_confidence := 'low';
  ELSE
    v_confidence := CASE 
      WHEN v_contribution_count >= 6 THEN 'high'
      WHEN v_contribution_count >= 3 THEN 'medium'
      ELSE 'low'
    END;
  END IF;
  
  -- Calculate prediction
  IF v_avg_monthly_contribution > 0 THEN
    v_months_to_complete := CEIL(v_remaining_amount / v_avg_monthly_contribution);
    v_predicted_date := (CURRENT_DATE + (v_months_to_complete || ' months')::interval)::date;
  ELSE
    v_predicted_date := NULL;
    v_confidence := 'none';
  END IF;
  
  RETURN jsonb_build_object(
    'goal_id', p_goal_id,
    'goal_name', v_goal.name,
    'target_amount', v_goal.target_amount,
    'current_amount', v_goal.current_amount,
    'remaining_amount', v_remaining_amount,
    'progress_pct', ROUND((v_goal.current_amount / v_goal.target_amount * 100)::numeric, 2),
    'deadline', v_goal.deadline,
    'prediction', jsonb_build_object(
      'avg_monthly_contribution', ROUND(v_avg_monthly_contribution::numeric, 2),
      'months_to_complete', v_months_to_complete,
      'predicted_completion_date', v_predicted_date,
      'confidence', v_confidence,
      'on_track', CASE 
        WHEN v_goal.deadline IS NULL THEN NULL
        WHEN v_predicted_date IS NULL THEN false
        ELSE v_predicted_date <= v_goal.deadline
      END
    )
  );
END;
$$;

-- Function to update goal current_amount from contributions
CREATE OR REPLACE FUNCTION public.update_goal_current_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.goals
  SET 
    current_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.goal_contributions
      WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id)
    ),
    status = CASE 
      WHEN current_amount >= target_amount THEN 'completed'
      ELSE status
    END,
    updated_at = now()
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to auto-update goal amount on contribution changes
CREATE TRIGGER update_goal_on_contribution
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_goal_current_amount();