-- =============================================
-- TRIGGER: Anomaly detection on new transactions
-- =============================================

-- Function to handle new transaction anomaly scoring
CREATE OR REPLACE FUNCTION public.handle_transaction_anomaly()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_anomaly_result record;
  v_settings record;
  v_threshold numeric := 50; -- Default threshold
BEGIN
  -- Only process expenses (negative amounts)
  IF NEW.amount >= 0 THEN
    RETURN NEW;
  END IF;
  
  -- Get user_id from connection
  SELECT bc.user_id INTO v_user_id
  FROM public.bank_accounts ba
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE ba.id = NEW.account_id;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check user's notification settings for custom threshold
  SELECT * INTO v_settings
  FROM public.notification_settings ns
  WHERE ns.user_id = v_user_id;
  
  IF v_settings IS NOT NULL AND v_settings.alert_preferences ? 'anomaly_threshold' THEN
    v_threshold := (v_settings.alert_preferences->>'anomaly_threshold')::numeric;
  END IF;
  
  -- Score the transaction
  SELECT * INTO v_anomaly_result
  FROM public.score_transaction_anomaly(NEW.id);
  
  -- If anomaly detected, create alert
  IF v_anomaly_result IS NOT NULL AND v_anomaly_result.is_anomaly THEN
    PERFORM public.create_alert(
      v_user_id,
      'anomaly',
      format('⚠️ Transação incomum detectada: %s', COALESCE(NEW.merchant_name, NEW.description, 'Desconhecido')),
      format('R$ %.2f - Score de anomalia: %.0f/100', ABS(NEW.amount), v_anomaly_result.anomaly_score),
      CASE 
        WHEN v_anomaly_result.anomaly_score >= 80 THEN 'critical'
        WHEN v_anomaly_result.anomaly_score >= 60 THEN 'warning'
        ELSE 'info'
      END,
      jsonb_build_object(
        'transaction_id', NEW.id,
        'amount', NEW.amount,
        'merchant_name', NEW.merchant_name,
        'description', NEW.description,
        'anomaly_score', v_anomaly_result.anomaly_score,
        'anomaly_reasons', v_anomaly_result.anomaly_reasons
      ),
      NULL, -- action_url
      now() + INTERVAL '7 days' -- expires in 7 days
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for new transactions
DROP TRIGGER IF EXISTS trigger_transaction_anomaly ON public.transactions;
CREATE TRIGGER trigger_transaction_anomaly
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_transaction_anomaly();

-- =============================================
-- TRIGGER: Update recurring payments on new transactions
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_recurring_payment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_recurring record;
BEGIN
  -- Only process expenses
  IF NEW.amount >= 0 OR NEW.merchant_name IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get user_id
  SELECT bc.user_id INTO v_user_id
  FROM public.bank_accounts ba
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE ba.id = NEW.account_id;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if this matches an existing recurring payment
  SELECT * INTO v_recurring
  FROM public.recurring_payments rp
  WHERE rp.user_id = v_user_id
    AND (
      rp.merchant_name = NEW.merchant_name
      OR (rp.merchant_pattern IS NOT NULL AND NEW.merchant_name ~* rp.merchant_pattern)
    )
    AND rp.is_active = true
  LIMIT 1;
  
  -- If found, update the recurring payment record
  IF v_recurring IS NOT NULL THEN
    UPDATE public.recurring_payments
    SET 
      last_payment_date = NEW.posted_at::date,
      next_due_date = CASE cadence
        WHEN 'weekly' THEN NEW.posted_at::date + INTERVAL '7 days'
        WHEN 'biweekly' THEN NEW.posted_at::date + INTERVAL '14 days'
        WHEN 'monthly' THEN NEW.posted_at::date + INTERVAL '1 month'
        WHEN 'quarterly' THEN NEW.posted_at::date + INTERVAL '3 months'
        WHEN 'yearly' THEN NEW.posted_at::date + INTERVAL '1 year'
        ELSE NEW.posted_at::date + INTERVAL '1 month'
      END,
      -- Update rolling average
      amount = (amount * 0.7 + ABS(NEW.amount) * 0.3),
      updated_at = now()
    WHERE id = v_recurring.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for recurring payment updates
DROP TRIGGER IF EXISTS trigger_recurring_payment_update ON public.transactions;
CREATE TRIGGER trigger_recurring_payment_update
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_recurring_payment_update();

-- =============================================
-- FUNCTION: Batch update all active goals progress
-- =============================================

CREATE OR REPLACE FUNCTION public.batch_update_goals_progress()
RETURNS TABLE(goals_updated integer, alerts_created integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_goal record;
  v_goals_updated integer := 0;
  v_alerts_created integer := 0;
BEGIN
  FOR v_goal IN (
    SELECT g.id, g.user_id
    FROM public.goals g
    WHERE g.status = 'active'
  )
  LOOP
    BEGIN
      -- Update progress
      PERFORM public.update_goal_progress(v_goal.user_id, v_goal.id);
      v_goals_updated := v_goals_updated + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error updating goal %: %', v_goal.id, SQLERRM;
    END;
  END LOOP;
  
  -- Check milestones for all users
  SELECT COUNT(*) INTO v_alerts_created
  FROM (
    SELECT public.check_goal_milestones(NULL)
  ) sub;
  
  RETURN QUERY SELECT v_goals_updated, v_alerts_created;
END;
$function$;

-- =============================================
-- FUNCTION: Run all scheduled maintenance tasks
-- =============================================

CREATE OR REPLACE FUNCTION public.run_scheduled_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_bills_result record;
  v_goals_result record;
  v_archived integer;
  v_recurring integer;
BEGIN
  -- 1. Scan for bill reminders (7 days ahead)
  SELECT * INTO v_bills_result
  FROM public.scan_for_bill_reminders(7, 100);
  
  v_result := v_result || jsonb_build_object(
    'bill_reminders', jsonb_build_object(
      'alerts_created', COALESCE(v_bills_result.alerts_created, 0),
      'users_processed', COALESCE(v_bills_result.users_processed, 0),
      'errors', COALESCE(v_bills_result.errors, 0)
    )
  );
  
  -- 2. Update goals progress
  SELECT * INTO v_goals_result
  FROM public.batch_update_goals_progress();
  
  v_result := v_result || jsonb_build_object(
    'goals', jsonb_build_object(
      'updated', COALESCE(v_goals_result.goals_updated, 0),
      'alerts_created', COALESCE(v_goals_result.alerts_created, 0)
    )
  );
  
  -- 3. Archive old alerts (90 days)
  SELECT public.archive_old_alerts(90) INTO v_archived;
  v_result := v_result || jsonb_build_object('alerts_archived', v_archived);
  
  -- 4. Detect recurring payments for users with recent transactions
  -- Run for each user with transactions in the last 24 hours
  WITH recent_users AS (
    SELECT DISTINCT bc.user_id
    FROM public.transactions t
    JOIN public.bank_accounts ba ON ba.id = t.account_id
    JOIN public.bank_connections bc ON bc.id = ba.connection_id
    WHERE t.created_at > now() - INTERVAL '24 hours'
    LIMIT 50
  )
  SELECT COALESCE(SUM(public.detect_recurring_payments(user_id)), 0)
  INTO v_recurring
  FROM recent_users;
  
  v_result := v_result || jsonb_build_object('recurring_detected', v_recurring);
  
  -- 5. Add timestamp
  v_result := v_result || jsonb_build_object(
    'executed_at', now(),
    'status', 'success'
  );
  
  RETURN v_result;
END;
$function$;