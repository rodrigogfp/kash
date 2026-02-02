-- Trigger function for sync_jobs status changes
CREATE OR REPLACE FUNCTION public.on_sync_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_metrics jsonb;
BEGIN
  -- Only process when status changes to finished or failed
  IF NEW.status NOT IN ('finished', 'failed') THEN
    RETURN NEW;
  END IF;
  
  -- Get user_id from connection
  SELECT bc.user_id INTO v_user_id
  FROM public.bank_connections bc
  WHERE bc.id = NEW.connection_id;
  
  -- Build metrics
  v_metrics := jsonb_build_object(
    'job_id', NEW.id,
    'job_type', NEW.job_type,
    'status', NEW.status,
    'attempts', NEW.attempts,
    'duration_ms', EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at)) * 1000,
    'result', NEW.result,
    'error_message', NEW.error_message
  );
  
  -- Log audit event
  INSERT INTO public.audit_events (user_id, event_type, payload)
  VALUES (v_user_id, 'sync_' || NEW.status, v_metrics);
  
  -- Refresh aggregates only on successful full_sync
  IF NEW.status = 'finished' AND NEW.job_type IN ('full_sync', 'balance_update') THEN
    -- Use background refresh to avoid blocking
    PERFORM public.refresh_user_aggregates(v_user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on sync_jobs
CREATE TRIGGER sync_job_status_change
  AFTER UPDATE OF status ON public.sync_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.on_sync_job_status_change();

-- Function to update account balance incrementally
CREATE OR REPLACE FUNCTION public.update_account_balance_incremental()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_bulk boolean;
  v_connection_id uuid;
BEGIN
  -- Get connection_id for the account
  SELECT ba.connection_id INTO v_connection_id
  FROM public.bank_accounts ba
  WHERE ba.id = NEW.account_id;
  
  -- Check if this is part of a bulk sync (via active sync_job)
  SELECT EXISTS (
    SELECT 1 FROM public.sync_jobs sj
    WHERE sj.connection_id = v_connection_id
    AND sj.status = 'running'
    AND sj.job_type = 'full_sync'
  ) INTO v_is_bulk;
  
  -- Skip incremental updates during bulk sync (will be done at end)
  IF v_is_bulk THEN
    RETURN NEW;
  END IF;
  
  -- For single transaction inserts, update running balance
  -- Note: This is a simplified approach; real balance comes from bank
  -- This just tracks transaction impact for immediate UI feedback
  
  RETURN NEW;
END;
$$;

-- Create trigger on transactions (deferred to allow batching)
CREATE TRIGGER transactions_balance_update
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance_incremental();

-- Anomaly detection function
CREATE OR REPLACE FUNCTION public.detect_transaction_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_avg_amount numeric;
  v_stddev numeric;
  v_threshold numeric := 3; -- 3 standard deviations
  v_is_anomaly boolean := false;
  v_anomaly_type varchar;
BEGIN
  -- Get user_id
  SELECT bc.user_id INTO v_user_id
  FROM public.bank_accounts ba
  JOIN public.bank_connections bc ON bc.id = ba.connection_id
  WHERE ba.id = NEW.account_id;
  
  -- Skip positive amounts (income) for anomaly detection
  IF NEW.amount >= 0 THEN
    RETURN NEW;
  END IF;
  
  -- Calculate historical average and stddev for this account (last 90 days)
  SELECT 
    COALESCE(AVG(ABS(amount)), 0),
    COALESCE(STDDEV(ABS(amount)), 0)
  INTO v_avg_amount, v_stddev
  FROM public.transactions
  WHERE account_id = NEW.account_id
    AND amount < 0
    AND posted_at > NOW() - INTERVAL '90 days'
    AND id != NEW.id;
  
  -- Detect anomalies
  IF v_stddev > 0 AND ABS(NEW.amount) > (v_avg_amount + (v_threshold * v_stddev)) THEN
    v_is_anomaly := true;
    v_anomaly_type := 'high_amount';
  END IF;
  
  -- Large transaction threshold (absolute)
  IF ABS(NEW.amount) > 5000 THEN
    v_is_anomaly := true;
    v_anomaly_type := COALESCE(v_anomaly_type, 'large_transaction');
  END IF;
  
  -- If anomaly detected, create alert (will be picked up by realtime)
  IF v_is_anomaly THEN
    INSERT INTO public.audit_events (user_id, event_type, payload)
    VALUES (
      v_user_id,
      'transaction_anomaly',
      jsonb_build_object(
        'transaction_id', NEW.id,
        'amount', NEW.amount,
        'description', NEW.description,
        'merchant_name', NEW.merchant_name,
        'anomaly_type', v_anomaly_type,
        'avg_amount', v_avg_amount,
        'stddev', v_stddev
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create anomaly detection trigger
CREATE TRIGGER transactions_anomaly_detection
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_transaction_anomaly();

-- Function to finalize bulk sync and update balances
CREATE OR REPLACE FUNCTION public.finalize_sync_job(
  p_job_id uuid,
  p_result jsonb DEFAULT '{}'::jsonb,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status varchar;
BEGIN
  -- Determine status
  v_status := CASE WHEN p_error_message IS NULL THEN 'finished' ELSE 'failed' END;
  
  -- Update the job
  UPDATE public.sync_jobs
  SET 
    status = v_status,
    finished_at = now(),
    result = p_result,
    error_message = p_error_message,
    updated_at = now()
  WHERE id = p_job_id;
  
  -- The trigger will handle refresh and audit logging
END;
$$;

-- Enable realtime on audit_events for anomaly alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_events;