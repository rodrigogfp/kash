-- ============================================
-- Profile & Security Management Schemas
-- ============================================

-- 1. Extend user_profiles with security fields
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS last_biometric_setup timestamptz,
ADD COLUMN IF NOT EXISTS security_metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_password_change timestamptz;

-- 2. Create bank_access_audit table for detailed bank permission tracking
CREATE TABLE IF NOT EXISTS public.bank_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.bank_connections(id) ON DELETE SET NULL,
  action varchar(50) NOT NULL CHECK (action IN ('grant', 'revoke', 'refresh', 'sync', 'error', 'reauthorize')),
  performed_by varchar(100) DEFAULT 'user', -- 'user', 'system', 'admin'
  provider_key varchar(100),
  bank_name varchar(255),
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for bank_access_audit
CREATE INDEX IF NOT EXISTS idx_bank_access_audit_user_id ON public.bank_access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_access_audit_connection_id ON public.bank_access_audit(connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_access_audit_created_at ON public.bank_access_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_access_audit_action ON public.bank_access_audit(action);

-- Enable RLS on bank_access_audit
ALTER TABLE public.bank_access_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_access_audit
CREATE POLICY "bank_access_audit_select_own" ON public.bank_access_audit
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bank_access_audit_insert_own" ON public.bank_access_audit
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bank_access_audit_all_service" ON public.bank_access_audit
  FOR ALL USING (is_service_role());

-- 3. Create function to log bank access events
CREATE OR REPLACE FUNCTION public.log_bank_access_event(
  p_user_id uuid,
  p_connection_id uuid,
  p_action varchar,
  p_provider_key varchar DEFAULT NULL,
  p_bank_name varchar DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO public.bank_access_audit (
    user_id, connection_id, action, provider_key, bank_name, metadata
  ) VALUES (
    p_user_id, p_connection_id, p_action, p_provider_key, p_bank_name, p_metadata
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- 4. Trigger to auto-log bank connection changes
CREATE OR REPLACE FUNCTION public.trigger_bank_connection_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action varchar;
  v_bank_name varchar;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'grant';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'revoke';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      v_action := 'revoke';
    ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
      v_action := 'reauthorize';
    ELSIF NEW.last_sync IS DISTINCT FROM OLD.last_sync THEN
      v_action := 'sync';
    ELSIF NEW.error_message IS NOT NULL AND OLD.error_message IS NULL THEN
      v_action := 'error';
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;
  
  -- Get bank name
  SELECT display_name INTO v_bank_name
  FROM public.supported_banks
  WHERE provider_key = COALESCE(NEW.provider_key, OLD.provider_key);
  
  -- Log the event
  PERFORM public.log_bank_access_event(
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.id, OLD.id),
    v_action,
    COALESCE(NEW.provider_key, OLD.provider_key),
    v_bank_name,
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'error_message', COALESCE(NEW.error_message, OLD.error_message)
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on bank_connections
DROP TRIGGER IF EXISTS trg_bank_connection_audit ON public.bank_connections;
CREATE TRIGGER trg_bank_connection_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_bank_connection_audit();

-- 5. Function to log password change events (called from edge function)
CREATE OR REPLACE FUNCTION public.log_password_change(
  p_user_id uuid,
  p_method varchar DEFAULT 'password_reset' -- 'password_reset', 'manual_change', 'admin_reset'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Update last password change in user_profiles
  UPDATE public.user_profiles
  SET last_password_change = now(), updated_at = now()
  WHERE id = p_user_id;
  
  -- Log audit event
  INSERT INTO public.audit_events (user_id, event_type, payload)
  VALUES (
    p_user_id,
    'password_change',
    jsonb_build_object(
      'method', p_method,
      'timestamp', now()
    )
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- 6. Function to update biometric settings
CREATE OR REPLACE FUNCTION public.update_biometric_settings(
  p_user_id uuid,
  p_enabled boolean,
  p_device_info jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership
  IF p_user_id != auth.uid() AND NOT is_service_role() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;
  
  UPDATE public.user_profiles
  SET 
    biometric_enabled = p_enabled,
    last_biometric_setup = CASE WHEN p_enabled THEN now() ELSE last_biometric_setup END,
    security_metadata = security_metadata || jsonb_build_object(
      'last_biometric_change', now(),
      'device_info', p_device_info
    ),
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Log audit event
  INSERT INTO public.audit_events (user_id, event_type, payload)
  VALUES (
    p_user_id,
    CASE WHEN p_enabled THEN 'biometric_enable' ELSE 'biometric_disable' END,
    jsonb_build_object('device_info', p_device_info)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'biometric_enabled', p_enabled,
    'updated_at', now()
  );
END;
$$;

-- 7. Function to get user security overview
CREATE OR REPLACE FUNCTION public.get_security_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_bank_count integer;
  v_recent_access jsonb;
  v_auth_methods jsonb;
BEGIN
  -- Verify ownership
  IF p_user_id != auth.uid() AND NOT is_service_role() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;
  
  -- Get profile
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;
  
  -- Count active bank connections
  SELECT COUNT(*) INTO v_bank_count
  FROM public.bank_connections
  WHERE user_id = p_user_id AND status = 'active';
  
  -- Get recent bank access events
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', baa.id,
      'action', baa.action,
      'bank_name', baa.bank_name,
      'created_at', baa.created_at
    ) ORDER BY baa.created_at DESC
  ), '[]'::jsonb)
  INTO v_recent_access
  FROM (
    SELECT * FROM public.bank_access_audit
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 10
  ) baa;
  
  -- Get linked auth providers
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'provider', ap.provider,
      'linked_at', ap.created_at
    )
  ), '[]'::jsonb)
  INTO v_auth_methods
  FROM public.auth_providers ap
  WHERE ap.user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'biometric_enabled', COALESCE(v_profile.biometric_enabled, false),
    'last_biometric_setup', v_profile.last_biometric_setup,
    'last_password_change', v_profile.last_password_change,
    'two_factor_enabled', COALESCE(v_profile.two_factor_enabled, false),
    'active_bank_connections', v_bank_count,
    'recent_bank_access', v_recent_access,
    'auth_methods', v_auth_methods,
    'profile_updated_at', v_profile.updated_at
  );
END;
$$;

-- 8. Add realtime for bank_access_audit (for live security monitoring)
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_access_audit;