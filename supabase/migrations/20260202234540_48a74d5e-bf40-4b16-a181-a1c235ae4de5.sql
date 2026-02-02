-- =====================================================
-- ENHANCED ANOMALY SCORING FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.score_transaction_anomaly(p_transaction_id uuid)
RETURNS TABLE(
  transaction_id uuid,
  anomaly_score numeric,
  anomaly_reasons jsonb,
  is_anomaly boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_user_id uuid;
  v_score numeric := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_avg_amount numeric;
  v_stddev numeric;
  v_merchant_avg numeric;
  v_category_avg numeric;
  v_user_threshold numeric := 3.0; -- default z-score threshold
  v_settings record;
BEGIN
  -- Get transaction details
  SELECT t.*, ba.connection_id
  INTO v_tx
  FROM public.transactions t
  JOIN public.bank_accounts ba ON ba.id = t.account_id
  WHERE t.id = p_transaction_id;
  
  IF v_tx IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user_id
  SELECT bc.user_id INTO v_user_id
  FROM public.bank_connections bc
  WHERE bc.id = v_tx.connection_id;
  
  -- Get user's notification settings for threshold customization
  SELECT * INTO v_settings
  FROM public.notification_settings ns
  WHERE ns.user_id = v_user_id;
  
  IF v_settings IS NOT NULL AND v_settings.alert_preferences ? 'anomaly_threshold' THEN
    v_user_threshold := (v_settings.alert_preferences->>'anomaly_threshold')::numeric;
  END IF;
  
  -- Skip income transactions
  IF v_tx.amount >= 0 THEN
    RETURN QUERY SELECT p_transaction_id, 0::numeric, '[]'::jsonb, false;
    RETURN;
  END IF;
  
  -- 1. Overall spending pattern analysis (last 90 days)
  SELECT 
    COALESCE(AVG(ABS(amount)), 0),
    COALESCE(STDDEV(ABS(amount)), 0)
  INTO v_avg_amount, v_stddev
  FROM public.transactions t
  JOIN public.bank_accounts ba ON ba.id = t.account_id
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE bc.user_id = v_user_id
    AND t.amount < 0
    AND t.posted_at > NOW() - INTERVAL '90 days'
    AND t.id != p_transaction_id;
  
  -- Z-score based anomaly
  IF v_stddev > 0 THEN
    DECLARE v_zscore numeric;
    BEGIN
      v_zscore := (ABS(v_tx.amount) - v_avg_amount) / v_stddev;
      IF v_zscore > v_user_threshold THEN
        v_score := v_score + LEAST(v_zscore / v_user_threshold, 3) * 30;
        v_reasons := v_reasons || jsonb_build_object(
          'type', 'high_zscore',
          'message', format('Amount is %.1f standard deviations above average', v_zscore),
          'weight', LEAST(v_zscore / v_user_threshold, 3) * 30
        );
      END IF;
    END;
  END IF;
  
  -- 2. Large absolute amount check
  IF ABS(v_tx.amount) > 5000 THEN
    v_score := v_score + 20;
    v_reasons := v_reasons || jsonb_build_object(
      'type', 'large_amount',
      'message', format('Large transaction over R$ 5,000'),
      'weight', 20
    );
  ELSIF ABS(v_tx.amount) > 2000 THEN
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_object(
      'type', 'moderate_large_amount',
      'message', format('Transaction over R$ 2,000'),
      'weight', 10
    );
  END IF;
  
  -- 3. Merchant pattern analysis
  IF v_tx.merchant_name IS NOT NULL THEN
    SELECT COALESCE(AVG(ABS(amount)), 0)
    INTO v_merchant_avg
    FROM public.transactions t
    JOIN public.bank_accounts ba ON ba.id = t.account_id
    JOIN public.bank_connections bc ON bc.id = ba.connection_id
    WHERE bc.user_id = v_user_id
      AND t.merchant_name = v_tx.merchant_name
      AND t.amount < 0
      AND t.id != p_transaction_id
      AND t.posted_at > NOW() - INTERVAL '180 days';
    
    IF v_merchant_avg > 0 AND ABS(v_tx.amount) > v_merchant_avg * 2 THEN
      v_score := v_score + 25;
      v_reasons := v_reasons || jsonb_build_object(
        'type', 'merchant_deviation',
        'message', format('Amount is %.0f%% higher than usual for %s', 
          ((ABS(v_tx.amount) / v_merchant_avg) - 1) * 100, v_tx.merchant_name),
        'weight', 25
      );
    END IF;
  END IF;
  
  -- 4. Category pattern analysis
  IF v_tx.category IS NOT NULL THEN
    SELECT COALESCE(AVG(ABS(amount)), 0)
    INTO v_category_avg
    FROM public.transactions t
    JOIN public.bank_accounts ba ON ba.id = t.account_id
    JOIN public.bank_connections bc ON bc.id = ba.connection_id
    WHERE bc.user_id = v_user_id
      AND t.category = v_tx.category
      AND t.amount < 0
      AND t.id != p_transaction_id
      AND t.posted_at > NOW() - INTERVAL '90 days';
    
    IF v_category_avg > 0 AND ABS(v_tx.amount) > v_category_avg * 3 THEN
      v_score := v_score + 15;
      v_reasons := v_reasons || jsonb_build_object(
        'type', 'category_deviation',
        'message', format('Amount is %.0f%% higher than category average', 
          ((ABS(v_tx.amount) / v_category_avg) - 1) * 100),
        'weight', 15
      );
    END IF;
  END IF;
  
  -- 5. First-time merchant (new relationship)
  IF v_tx.merchant_name IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.bank_accounts ba ON ba.id = t.account_id
      JOIN public.bank_connections bc ON bc.id = ba.connection_id
      WHERE bc.user_id = v_user_id
        AND t.merchant_name = v_tx.merchant_name
        AND t.id != p_transaction_id
    ) THEN
      v_score := v_score + 10;
      v_reasons := v_reasons || jsonb_build_object(
        'type', 'new_merchant',
        'message', format('First transaction with %s', v_tx.merchant_name),
        'weight', 10
      );
    END IF;
  END IF;
  
  -- Normalize score to 0-100
  v_score := LEAST(v_score, 100);
  
  RETURN QUERY SELECT 
    p_transaction_id,
    ROUND(v_score, 2),
    v_reasons,
    v_score >= 50; -- Anomaly threshold at 50
END;
$$;

-- =====================================================
-- ENHANCED GOAL PROGRESS UPDATE
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_goal_progress(p_user_id uuid, p_goal_id uuid)
RETURNS TABLE(
  goal_id uuid,
  name varchar,
  target_amount numeric,
  current_amount numeric,
  progress_pct numeric,
  status varchar,
  days_remaining integer,
  on_track boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal record;
  v_contribution_total numeric;
  v_new_status varchar;
  v_prediction record;
BEGIN
  -- Verify ownership
  SELECT * INTO v_goal
  FROM public.goals g
  WHERE g.id = p_goal_id AND g.user_id = p_user_id;
  
  IF v_goal IS NULL THEN
    RAISE EXCEPTION 'Goal not found or access denied';
  END IF;
  
  -- Calculate total from contributions
  SELECT COALESCE(SUM(gc.amount), 0)
  INTO v_contribution_total
  FROM public.goal_contributions gc
  WHERE gc.goal_id = p_goal_id;
  
  -- Determine new status
  v_new_status := CASE
    WHEN v_contribution_total >= v_goal.target_amount THEN 'completed'
    WHEN v_goal.deadline IS NOT NULL AND v_goal.deadline < CURRENT_DATE THEN 'expired'
    ELSE 'active'
  END;
  
  -- Update goal
  UPDATE public.goals
  SET 
    current_amount = v_contribution_total,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_goal_id;
  
  -- Check if goal was just completed and create alert
  IF v_new_status = 'completed' AND v_goal.status != 'completed' THEN
    PERFORM public.create_alert(
      p_user_id,
      'goal_progress',
      format('🎉 Goal completed: %s', v_goal.name),
      format('You reached your target of R$ %.2f!', v_goal.target_amount),
      'info',
      jsonb_build_object(
        'goal_id', p_goal_id,
        'goal_name', v_goal.name,
        'target_amount', v_goal.target_amount,
        'event', 'completed'
      )
    );
  END IF;
  
  -- Get prediction
  SELECT * INTO v_prediction
  FROM jsonb_to_record(public.predict_goal_completion(p_user_id, p_goal_id)) 
  AS x(prediction jsonb);
  
  RETURN QUERY SELECT
    p_goal_id,
    v_goal.name,
    v_goal.target_amount,
    v_contribution_total,
    ROUND((v_contribution_total / NULLIF(v_goal.target_amount, 0) * 100)::numeric, 2),
    v_new_status::varchar,
    CASE WHEN v_goal.deadline IS NOT NULL 
      THEN (v_goal.deadline - CURRENT_DATE)::integer 
      ELSE NULL 
    END,
    CASE 
      WHEN v_goal.deadline IS NULL THEN NULL
      WHEN v_prediction.prediction IS NULL THEN NULL
      ELSE (v_prediction.prediction->>'on_track')::boolean
    END;
END;
$$;

-- =====================================================
-- SCAN FOR BILL REMINDERS (Enhanced batch processing)
-- =====================================================
CREATE OR REPLACE FUNCTION public.scan_for_bill_reminders(
  p_days_ahead integer DEFAULT 7,
  p_batch_size integer DEFAULT 100
)
RETURNS TABLE(
  alerts_created integer,
  users_processed integer,
  errors integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts_created integer := 0;
  v_users_processed integer := 0;
  v_errors integer := 0;
  v_bill record;
  v_user_settings record;
  v_should_notify boolean;
BEGIN
  -- Process bills in batches
  FOR v_bill IN (
    SELECT 
      rp.*,
      rp.next_due_date - CURRENT_DATE as days_until_due,
      u.email,
      u.full_name
    FROM public.recurring_payments rp
    JOIN public.users u ON u.id = rp.user_id
    WHERE rp.is_active = true
      AND rp.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_ahead || ' days')::interval
      AND rp.next_due_date >= CURRENT_DATE
    ORDER BY rp.next_due_date
    LIMIT p_batch_size
  )
  LOOP
    BEGIN
      -- Get user notification settings
      SELECT * INTO v_user_settings
      FROM public.notification_settings ns
      WHERE ns.user_id = v_bill.user_id;
      
      -- Check if user wants bill_due notifications
      v_should_notify := true;
      IF v_user_settings IS NOT NULL THEN
        v_should_notify := COALESCE(
          (v_user_settings.alert_preferences->'bill_due'->>'push')::boolean,
          true
        );
      END IF;
      
      -- Skip if user disabled bill notifications
      IF NOT v_should_notify THEN
        CONTINUE;
      END IF;
      
      -- Check if alert already exists (prevent duplicates)
      IF EXISTS (
        SELECT 1 FROM public.alerts a
        WHERE a.user_id = v_bill.user_id
          AND a.alert_type = 'bill_due'
          AND (a.payload->>'recurring_payment_id')::uuid = v_bill.id
          AND a.payload->>'due_date' = v_bill.next_due_date::text
          AND a.created_at > now() - INTERVAL '1 day'
      ) THEN
        CONTINUE;
      END IF;
      
      -- Create the alert
      PERFORM public.create_alert(
        v_bill.user_id,
        'bill_due',
        CASE 
          WHEN v_bill.days_until_due = 0 THEN format('📅 Bill due today: %s', v_bill.merchant_name)
          WHEN v_bill.days_until_due = 1 THEN format('📅 Bill due tomorrow: %s', v_bill.merchant_name)
          ELSE format('📅 Bill due in %s days: %s', v_bill.days_until_due, v_bill.merchant_name)
        END,
        format('R$ %.2f due on %s', v_bill.amount, to_char(v_bill.next_due_date, 'DD/MM/YYYY')),
        CASE 
          WHEN v_bill.days_until_due <= 1 THEN 'critical'
          WHEN v_bill.days_until_due <= 3 THEN 'warning'
          ELSE 'info'
        END,
        jsonb_build_object(
          'recurring_payment_id', v_bill.id,
          'merchant_name', v_bill.merchant_name,
          'amount', v_bill.amount,
          'currency', v_bill.currency,
          'due_date', v_bill.next_due_date,
          'days_until_due', v_bill.days_until_due,
          'is_essential', v_bill.is_essential
        ),
        NULL, -- action_url
        v_bill.next_due_date::timestamptz + INTERVAL '1 day' -- expires after due date
      );
      
      v_alerts_created := v_alerts_created + 1;
      v_users_processed := v_users_processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Error processing bill reminder for user %: %', v_bill.user_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_alerts_created, v_users_processed, v_errors;
END;
$$;

-- =====================================================
-- CHECK GOAL MILESTONES (for progress alerts)
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_goal_milestones(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal record;
  v_alert_count integer := 0;
  v_progress_pct numeric;
  v_milestone integer;
  v_milestones integer[] := ARRAY[25, 50, 75, 90];
BEGIN
  FOR v_goal IN (
    SELECT g.*
    FROM public.goals g
    WHERE g.status = 'active'
      AND (p_user_id IS NULL OR g.user_id = p_user_id)
  )
  LOOP
    v_progress_pct := (v_goal.current_amount / NULLIF(v_goal.target_amount, 0)) * 100;
    
    -- Check each milestone
    FOREACH v_milestone IN ARRAY v_milestones
    LOOP
      -- If we just crossed this milestone
      IF v_progress_pct >= v_milestone THEN
        -- Check if we already alerted for this milestone
        IF NOT EXISTS (
          SELECT 1 FROM public.alerts a
          WHERE a.user_id = v_goal.user_id
            AND a.alert_type = 'goal_progress'
            AND (a.payload->>'goal_id')::uuid = v_goal.id
            AND (a.payload->>'milestone')::integer = v_milestone
        ) THEN
          PERFORM public.create_alert(
            v_goal.user_id,
            'goal_progress',
            format('🎯 %s%% of "%s" achieved!', v_milestone, v_goal.name),
            format('R$ %.2f of R$ %.2f saved', v_goal.current_amount, v_goal.target_amount),
            'info',
            jsonb_build_object(
              'goal_id', v_goal.id,
              'goal_name', v_goal.name,
              'milestone', v_milestone,
              'current_amount', v_goal.current_amount,
              'target_amount', v_goal.target_amount,
              'progress_pct', ROUND(v_progress_pct, 2)
            )
          );
          v_alert_count := v_alert_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN v_alert_count;
END;
$$;

-- =====================================================
-- LOW BALANCE ALERT FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_low_balance_alerts(p_threshold numeric DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account record;
  v_alert_count integer := 0;
  v_user_threshold numeric;
BEGIN
  FOR v_account IN (
    SELECT 
      ba.*,
      bc.user_id,
      sb.display_name as bank_name
    FROM public.bank_accounts ba
    JOIN public.bank_connections bc ON bc.id = ba.connection_id
    LEFT JOIN public.supported_banks sb ON sb.provider_key = bc.provider_key
    WHERE bc.status = 'active'
      AND ba.current_balance IS NOT NULL
  )
  LOOP
    -- Get user-specific threshold if set
    SELECT COALESCE(
      (ns.alert_preferences->>'low_balance_threshold')::numeric,
      p_threshold
    ) INTO v_user_threshold
    FROM public.notification_settings ns
    WHERE ns.user_id = v_account.user_id;
    
    v_user_threshold := COALESCE(v_user_threshold, p_threshold);
    
    -- Check if balance is below threshold
    IF v_account.current_balance < v_user_threshold THEN
      -- Avoid duplicate alerts within 24h
      IF NOT EXISTS (
        SELECT 1 FROM public.alerts a
        WHERE a.user_id = v_account.user_id
          AND a.alert_type = 'low_balance'
          AND (a.payload->>'account_id')::uuid = v_account.id
          AND a.created_at > now() - INTERVAL '24 hours'
      ) THEN
        PERFORM public.create_alert(
          v_account.user_id,
          'low_balance',
          format('⚠️ Low balance: %s', v_account.name),
          format('Balance is R$ %.2f (below R$ %.2f threshold)', 
            v_account.current_balance, v_user_threshold),
          CASE 
            WHEN v_account.current_balance < 0 THEN 'critical'
            WHEN v_account.current_balance < v_user_threshold / 2 THEN 'warning'
            ELSE 'info'
          END,
          jsonb_build_object(
            'account_id', v_account.id,
            'account_name', v_account.name,
            'bank_name', v_account.bank_name,
            'current_balance', v_account.current_balance,
            'threshold', v_user_threshold
          )
        );
        v_alert_count := v_alert_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_alert_count;
END;
$$;

-- =====================================================
-- ARCHIVE OLD ALERTS (maintenance function)
-- =====================================================
CREATE OR REPLACE FUNCTION public.archive_old_alerts(p_days_old integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete old dismissed or seen alerts
  DELETE FROM public.alerts
  WHERE (dismissed = true OR seen = true)
    AND created_at < now() - (p_days_old || ' days')::interval;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Also delete expired alerts
  DELETE FROM public.alerts
  WHERE expires_at IS NOT NULL AND expires_at < now() - INTERVAL '7 days';
  
  RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- MASTER ALERT SCAN FUNCTION (for scheduled jobs)
-- =====================================================
CREATE OR REPLACE FUNCTION public.run_scheduled_alert_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_result record;
  v_goal_alerts integer;
  v_low_balance_alerts integer;
  v_archived integer;
BEGIN
  -- Run all alert scans
  SELECT * INTO v_bill_result FROM public.scan_for_bill_reminders(7, 500);
  v_goal_alerts := public.check_goal_milestones();
  v_low_balance_alerts := public.check_low_balance_alerts();
  v_archived := public.archive_old_alerts(90);
  
  RETURN jsonb_build_object(
    'executed_at', now(),
    'bill_reminders', jsonb_build_object(
      'alerts_created', v_bill_result.alerts_created,
      'users_processed', v_bill_result.users_processed,
      'errors', v_bill_result.errors
    ),
    'goal_milestones', v_goal_alerts,
    'low_balance_alerts', v_low_balance_alerts,
    'archived_alerts', v_archived
  );
END;
$$;