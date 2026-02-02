-- =====================================================
-- ALERTS TABLE - For anomalies, bill reminders, goal progress
-- =====================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alert_type varchar(50) NOT NULL, -- anomaly, bill_due, goal_progress, large_transaction, low_balance
  severity varchar(20) NOT NULL DEFAULT 'info', -- info, warning, critical
  title varchar(255) NOT NULL,
  message text,
  payload jsonb DEFAULT '{}'::jsonb,
  seen boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  action_url varchar(500),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX idx_alerts_user_unseen ON public.alerts(user_id, seen) WHERE seen = false;
CREATE INDEX idx_alerts_type ON public.alerts(alert_type);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at DESC);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "alerts_select_own" ON public.alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "alerts_update_own" ON public.alerts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "alerts_delete_own" ON public.alerts
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "alerts_insert_service" ON public.alerts
  FOR INSERT WITH CHECK (is_service_role());

CREATE POLICY "alerts_all_service" ON public.alerts
  FOR ALL USING (is_service_role());

-- =====================================================
-- NOTIFICATION SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  daily_summary_enabled boolean NOT NULL DEFAULT false,
  daily_summary_time time DEFAULT '09:00:00',
  weekly_report_enabled boolean NOT NULL DEFAULT true,
  alert_preferences jsonb NOT NULL DEFAULT '{
    "anomaly": {"push": true, "email": true},
    "bill_due": {"push": true, "email": true},
    "goal_progress": {"push": true, "email": false},
    "large_transaction": {"push": true, "email": false},
    "low_balance": {"push": true, "email": true}
  }'::jsonb,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "notification_settings_select_own" ON public.notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_settings_insert_own" ON public.notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_settings_update_own" ON public.notification_settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_settings_all_service" ON public.notification_settings
  FOR ALL USING (is_service_role());

-- Trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RECURRING PAYMENTS TABLE (detected subscriptions/bills)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.recurring_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  merchant_name varchar(255) NOT NULL,
  merchant_pattern varchar(500), -- regex pattern for matching
  amount numeric NOT NULL,
  amount_variance numeric DEFAULT 0, -- allowed variance for matching
  currency varchar(3) NOT NULL DEFAULT 'BRL',
  cadence varchar(20) NOT NULL DEFAULT 'monthly', -- daily, weekly, biweekly, monthly, quarterly, yearly
  last_payment_date date,
  next_due_date date,
  is_active boolean NOT NULL DEFAULT true,
  is_essential boolean NOT NULL DEFAULT false, -- bills vs subscriptions
  category varchar(100),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  confidence_score numeric DEFAULT 0, -- 0-1 detection confidence
  detection_method varchar(50) DEFAULT 'auto', -- auto, manual
  reminder_days_before integer DEFAULT 3,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recurring_payments_user_id ON public.recurring_payments(user_id);
CREATE INDEX idx_recurring_payments_next_due ON public.recurring_payments(next_due_date) WHERE is_active = true;
CREATE INDEX idx_recurring_payments_merchant ON public.recurring_payments(user_id, merchant_name);

-- Enable RLS
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "recurring_payments_select_own" ON public.recurring_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "recurring_payments_insert_own" ON public.recurring_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring_payments_update_own" ON public.recurring_payments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recurring_payments_delete_own" ON public.recurring_payments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "recurring_payments_all_service" ON public.recurring_payments
  FOR ALL USING (is_service_role());

-- Trigger for updated_at
CREATE TRIGGER update_recurring_payments_updated_at
  BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to create an alert
CREATE OR REPLACE FUNCTION public.create_alert(
  p_user_id uuid,
  p_alert_type varchar,
  p_title varchar,
  p_message text DEFAULT NULL,
  p_severity varchar DEFAULT 'info',
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_action_url varchar DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert_id uuid;
  v_settings record;
BEGIN
  -- Check notification settings
  SELECT * INTO v_settings
  FROM public.notification_settings
  WHERE user_id = p_user_id;
  
  -- Create alert regardless of settings (for in-app display)
  INSERT INTO public.alerts (
    user_id, alert_type, title, message, severity, payload, action_url, expires_at
  ) VALUES (
    p_user_id, p_alert_type, p_title, p_message, p_severity, p_payload, p_action_url, p_expires_at
  ) RETURNING id INTO v_alert_id;
  
  -- TODO: Trigger push/email notifications based on settings
  -- This would call an edge function for actual notification delivery
  
  RETURN v_alert_id;
END;
$$;

-- Function to detect recurring payments from transaction history
CREATE OR REPLACE FUNCTION public.detect_recurring_payments(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detected_count integer := 0;
  v_recurring record;
BEGIN
  -- Find transactions that appear regularly (same merchant, similar amount, monthly pattern)
  FOR v_recurring IN (
    WITH merchant_transactions AS (
      SELECT 
        t.merchant_name,
        t.amount,
        t.posted_at::date as tx_date,
        ba.id as account_id,
        COUNT(*) OVER (PARTITION BY t.merchant_name) as occurrence_count,
        AVG(t.amount) OVER (PARTITION BY t.merchant_name) as avg_amount,
        STDDEV(t.amount) OVER (PARTITION BY t.merchant_name) as amount_stddev,
        MAX(t.posted_at) OVER (PARTITION BY t.merchant_name) as last_payment
      FROM public.transactions t
      JOIN public.bank_accounts ba ON ba.id = t.account_id
      JOIN public.bank_connections bc ON bc.id = ba.connection_id
      WHERE bc.user_id = p_user_id
        AND t.amount < 0  -- expenses only
        AND t.merchant_name IS NOT NULL
        AND t.posted_at > now() - INTERVAL '6 months'
    )
    SELECT DISTINCT
      merchant_name,
      account_id,
      ABS(avg_amount) as avg_amount,
      COALESCE(amount_stddev, 0) as amount_variance,
      occurrence_count,
      last_payment::date as last_payment_date,
      -- Estimate cadence based on occurrence
      CASE 
        WHEN occurrence_count >= 20 THEN 'weekly'
        WHEN occurrence_count >= 5 THEN 'monthly'
        WHEN occurrence_count >= 2 THEN 'quarterly'
        ELSE 'monthly'
      END as estimated_cadence,
      -- Confidence based on consistency
      CASE 
        WHEN occurrence_count >= 6 AND COALESCE(amount_stddev, 0) / NULLIF(ABS(avg_amount), 1) < 0.1 THEN 0.9
        WHEN occurrence_count >= 3 THEN 0.7
        ELSE 0.5
      END as confidence
    FROM merchant_transactions
    WHERE occurrence_count >= 2
      AND ABS(avg_amount) >= 10  -- Minimum R$10
    ORDER BY occurrence_count DESC
    LIMIT 50
  )
  LOOP
    -- Upsert detected recurring payment
    INSERT INTO public.recurring_payments (
      user_id, account_id, merchant_name, amount, amount_variance,
      cadence, last_payment_date, next_due_date, confidence_score, detection_method
    ) VALUES (
      p_user_id,
      v_recurring.account_id,
      v_recurring.merchant_name,
      v_recurring.avg_amount,
      v_recurring.amount_variance,
      v_recurring.estimated_cadence,
      v_recurring.last_payment_date,
      CASE v_recurring.estimated_cadence
        WHEN 'weekly' THEN v_recurring.last_payment_date + INTERVAL '7 days'
        WHEN 'biweekly' THEN v_recurring.last_payment_date + INTERVAL '14 days'
        WHEN 'monthly' THEN v_recurring.last_payment_date + INTERVAL '1 month'
        WHEN 'quarterly' THEN v_recurring.last_payment_date + INTERVAL '3 months'
        WHEN 'yearly' THEN v_recurring.last_payment_date + INTERVAL '1 year'
        ELSE v_recurring.last_payment_date + INTERVAL '1 month'
      END,
      v_recurring.confidence,
      'auto'
    )
    ON CONFLICT (user_id, merchant_name) DO UPDATE SET
      amount = EXCLUDED.amount,
      amount_variance = EXCLUDED.amount_variance,
      last_payment_date = EXCLUDED.last_payment_date,
      next_due_date = EXCLUDED.next_due_date,
      confidence_score = GREATEST(recurring_payments.confidence_score, EXCLUDED.confidence_score),
      updated_at = now()
    WHERE recurring_payments.detection_method = 'auto'; -- Don't overwrite manual entries
    
    v_detected_count := v_detected_count + 1;
  END LOOP;
  
  RETURN v_detected_count;
END;
$$;

-- Add unique constraint for upsert
ALTER TABLE public.recurring_payments 
  ADD CONSTRAINT recurring_payments_user_merchant_unique 
  UNIQUE (user_id, merchant_name);

-- Function to check and create bill due alerts
CREATE OR REPLACE FUNCTION public.check_upcoming_bills(p_days_ahead integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill record;
  v_alert_count integer := 0;
BEGIN
  FOR v_bill IN (
    SELECT 
      rp.*,
      rp.next_due_date - CURRENT_DATE as days_until_due
    FROM public.recurring_payments rp
    WHERE rp.is_active = true
      AND rp.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_ahead || ' days')::interval
      AND rp.next_due_date >= CURRENT_DATE
  )
  LOOP
    -- Check if alert already exists for this bill/date
    IF NOT EXISTS (
      SELECT 1 FROM public.alerts
      WHERE user_id = v_bill.user_id
        AND alert_type = 'bill_due'
        AND (payload->>'recurring_payment_id')::uuid = v_bill.id
        AND created_at > now() - INTERVAL '1 day'
    ) THEN
      PERFORM public.create_alert(
        v_bill.user_id,
        'bill_due',
        format('Bill due in %s days: %s', v_bill.days_until_due, v_bill.merchant_name),
        format('R$ %.2f due on %s', v_bill.amount, to_char(v_bill.next_due_date, 'DD/MM')),
        CASE WHEN v_bill.days_until_due <= 1 THEN 'critical' 
             WHEN v_bill.days_until_due <= 3 THEN 'warning'
             ELSE 'info' END,
        jsonb_build_object(
          'recurring_payment_id', v_bill.id,
          'merchant_name', v_bill.merchant_name,
          'amount', v_bill.amount,
          'due_date', v_bill.next_due_date
        )
      );
      v_alert_count := v_alert_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_alert_count;
END;
$$;

-- Function to get user's unread alerts count
CREATE OR REPLACE FUNCTION public.get_unread_alerts_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.alerts
  WHERE user_id = p_user_id
    AND seen = false
    AND dismissed = false
    AND (expires_at IS NULL OR expires_at > now())
$$;