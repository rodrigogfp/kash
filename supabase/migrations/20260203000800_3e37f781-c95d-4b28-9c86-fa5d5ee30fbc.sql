-- =============================================
-- ADD: status and finished_at columns for async generation
-- =============================================

ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'ready' 
  CHECK (status IN ('pending', 'processing', 'ready', 'failed'));

ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS error_message text;

-- Index for status queries (polling for pending reports)
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(user_id, status) 
WHERE status IN ('pending', 'processing');

-- =============================================
-- TABLE: subscriptions (for premium features)
-- =============================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan varchar NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + INTERVAL '1 month'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  stripe_customer_id varchar,
  stripe_subscription_id varchar,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_user_unique UNIQUE (user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_all_service" ON public.subscriptions
  FOR ALL
  USING (is_service_role());

-- Updated_at trigger
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTION: Check if user has premium plan
-- =============================================

CREATE OR REPLACE FUNCTION public.user_has_premium(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
      AND plan IN ('pro', 'enterprise')
      AND status IN ('active', 'trialing')
      AND current_period_end > now()
  )
$function$;

-- =============================================
-- FUNCTION: Get user's subscription details
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_subscription(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription record;
BEGIN
  -- Verify ownership or service role
  IF p_user_id != auth.uid() AND NOT is_service_role() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;
  
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id;
  
  IF v_subscription IS NULL THEN
    -- Return free plan info if no subscription exists
    RETURN jsonb_build_object(
      'plan', 'free',
      'status', 'active',
      'is_premium', false,
      'limits', jsonb_build_object(
        'max_bank_connections', 2,
        'max_chat_messages_per_day', 10,
        'can_generate_tax_report', false,
        'can_export_csv', true
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'id', v_subscription.id,
    'plan', v_subscription.plan,
    'status', v_subscription.status,
    'is_premium', v_subscription.plan IN ('pro', 'enterprise') AND v_subscription.status IN ('active', 'trialing'),
    'current_period_start', v_subscription.current_period_start,
    'current_period_end', v_subscription.current_period_end,
    'cancel_at_period_end', v_subscription.cancel_at_period_end,
    'limits', CASE v_subscription.plan
      WHEN 'pro' THEN jsonb_build_object(
        'max_bank_connections', -1, -- unlimited
        'max_chat_messages_per_day', -1, -- unlimited
        'can_generate_tax_report', true,
        'can_export_csv', true
      )
      WHEN 'enterprise' THEN jsonb_build_object(
        'max_bank_connections', -1,
        'max_chat_messages_per_day', -1,
        'can_generate_tax_report', true,
        'can_export_csv', true,
        'priority_support', true
      )
      ELSE jsonb_build_object(
        'max_bank_connections', 2,
        'max_chat_messages_per_day', 10,
        'can_generate_tax_report', false,
        'can_export_csv', true
      )
    END
  );
END;
$function$;

-- =============================================
-- FUNCTION: Validate report generation permission
-- =============================================

CREATE OR REPLACE FUNCTION public.can_generate_report(
  p_user_id uuid,
  p_report_type varchar
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_premium boolean;
  v_pending_count integer;
BEGIN
  -- Check premium status
  v_is_premium := public.user_has_premium(p_user_id);
  
  -- Tax reports require premium
  IF p_report_type IN ('annual', 'tax') AND NOT v_is_premium THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Relatórios fiscais/anuais requerem plano Pro',
      'upgrade_required', true
    );
  END IF;
  
  -- Check for pending reports (limit concurrent generation)
  SELECT COUNT(*) INTO v_pending_count
  FROM public.reports
  WHERE user_id = p_user_id
    AND status IN ('pending', 'processing');
  
  IF v_pending_count >= 3 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Você já tem 3 relatórios em processamento. Aguarde a conclusão.',
      'pending_count', v_pending_count
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'is_premium', v_is_premium
  );
END;
$function$;

-- =============================================
-- FUNCTION: Create pending report
-- =============================================

CREATE OR REPLACE FUNCTION public.create_pending_report(
  p_user_id uuid,
  p_report_type varchar,
  p_title varchar,
  p_period_start date,
  p_period_end date,
  p_file_format varchar DEFAULT 'pdf',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_can_generate jsonb;
  v_report_id uuid;
  v_file_path varchar;
BEGIN
  -- Verify ownership
  IF p_user_id != auth.uid() AND NOT is_service_role() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;
  
  -- Check permissions
  v_can_generate := public.can_generate_report(p_user_id, p_report_type);
  
  IF NOT (v_can_generate->>'allowed')::boolean THEN
    RETURN v_can_generate;
  END IF;
  
  -- Generate file path
  v_file_path := format(
    '%s/%s/%s/%s.%s',
    p_user_id,
    p_report_type,
    EXTRACT(YEAR FROM p_period_start),
    gen_random_uuid(),
    p_file_format
  );
  
  -- Create pending report
  INSERT INTO public.reports (
    user_id, report_type, title, period_start, period_end,
    file_path, file_format, status, metadata
  ) VALUES (
    p_user_id, p_report_type, p_title, p_period_start, p_period_end,
    v_file_path, p_file_format, 'pending', p_metadata
  )
  RETURNING id INTO v_report_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'file_path', v_file_path,
    'status', 'pending'
  );
END;
$function$;

-- =============================================
-- FUNCTION: Update report status
-- =============================================

CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id uuid,
  p_status varchar,
  p_file_size bigint DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only service role can update status
  IF NOT is_service_role() THEN
    RETURN jsonb_build_object('error', 'Only service role can update report status');
  END IF;
  
  UPDATE public.reports
  SET 
    status = p_status,
    file_size = COALESCE(p_file_size, file_size),
    error_message = p_error_message,
    finished_at = CASE WHEN p_status IN ('ready', 'failed') THEN now() ELSE finished_at END,
    updated_at = now()
  WHERE id = p_report_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'status', p_status
  );
END;
$function$;

-- =============================================
-- Enable realtime for reports status updates
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;