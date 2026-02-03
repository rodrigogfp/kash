-- =============================================
-- STORAGE BUCKET: reports (private)
-- =============================================

-- Create the reports bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800, -- 50MB max file size
  ARRAY['application/pdf', 'text/csv', 'text/plain']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================
-- TABLE: reports (metadata)
-- =============================================

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_type varchar NOT NULL CHECK (report_type IN ('monthly', 'annual', 'tax', 'custom', 'export')),
  title varchar NOT NULL,
  description text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  file_path varchar NOT NULL, -- reports/{user_id}/{report_type}/{YYYY}/{uuid}.pdf
  file_size bigint,
  file_format varchar NOT NULL DEFAULT 'pdf' CHECK (file_format IN ('pdf', 'csv')),
  currency varchar NOT NULL DEFAULT 'BRL',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_preserved boolean NOT NULL DEFAULT false, -- If true, skip auto-deletion
  expires_at timestamptz, -- Auto-calculated based on retention policy
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_period ON public.reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reports_expires ON public.reports(expires_at) WHERE is_preserved = false;

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: reports table
-- =============================================

-- Users can view their own reports
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own reports (via edge function)
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reports (e.g., mark as preserved)
CREATE POLICY "reports_update_own" ON public.reports
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reports
CREATE POLICY "reports_delete_own" ON public.reports
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "reports_all_service" ON public.reports
  FOR ALL
  USING (is_service_role());

-- =============================================
-- RLS POLICIES: storage.objects for reports bucket
-- =============================================

-- Users can view their own reports (path starts with their user_id)
CREATE POLICY "reports_storage_select_own" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'reports' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role can insert reports (edge functions generate reports)
CREATE POLICY "reports_storage_insert_service" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'reports'
    AND is_service_role()
  );

-- Service role can delete reports (for cleanup)
CREATE POLICY "reports_storage_delete_service" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'reports'
    AND is_service_role()
  );

-- Users can delete their own reports
CREATE POLICY "reports_storage_delete_own" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- FUNCTION: Generate signed URL for report download
-- =============================================

CREATE OR REPLACE FUNCTION public.get_report_download_url(
  p_report_id uuid,
  p_expires_in integer DEFAULT 3600 -- 1 hour default
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  v_report record;
  v_signed_url text;
BEGIN
  -- Get report and verify ownership
  SELECT * INTO v_report
  FROM public.reports
  WHERE id = p_report_id AND user_id = auth.uid();
  
  IF v_report IS NULL THEN
    RETURN jsonb_build_object('error', 'Report not found or access denied');
  END IF;
  
  -- Generate signed URL using storage API
  -- Note: This returns the path; actual signed URL generation happens in edge function
  RETURN jsonb_build_object(
    'report_id', v_report.id,
    'file_path', v_report.file_path,
    'file_format', v_report.file_format,
    'title', v_report.title,
    'generated_at', v_report.generated_at,
    'expires_in', p_expires_in
  );
END;
$function$;

-- =============================================
-- FUNCTION: Set report expiration based on retention policy
-- =============================================

CREATE OR REPLACE FUNCTION public.set_report_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_retention_days integer := 365; -- Default retention: 1 year
BEGIN
  -- Don't set expiration for preserved reports
  IF NEW.is_preserved THEN
    NEW.expires_at := NULL;
    RETURN NEW;
  END IF;
  
  -- Set expiration date
  NEW.expires_at := NEW.generated_at + (v_retention_days || ' days')::interval;
  
  RETURN NEW;
END;
$function$;

-- Trigger to set expiration on insert
CREATE TRIGGER set_report_expiration_trigger
BEFORE INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.set_report_expiration();

-- Trigger to update expiration when is_preserved changes
CREATE OR REPLACE FUNCTION public.update_report_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_preserved IS DISTINCT FROM NEW.is_preserved THEN
    IF NEW.is_preserved THEN
      NEW.expires_at := NULL;
    ELSE
      NEW.expires_at := NEW.generated_at + INTERVAL '365 days';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_report_expiration_trigger
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.update_report_expiration();

-- =============================================
-- FUNCTION: Clean up expired reports
-- =============================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_reports()
RETURNS TABLE(deleted_count integer, freed_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_count integer := 0;
  v_freed_bytes bigint := 0;
  v_report record;
BEGIN
  -- Find and delete expired reports
  FOR v_report IN (
    SELECT id, file_path, file_size
    FROM public.reports
    WHERE expires_at IS NOT NULL
      AND expires_at < now()
      AND is_preserved = false
    LIMIT 100 -- Process in batches
  )
  LOOP
    BEGIN
      -- Delete from storage first
      DELETE FROM storage.objects
      WHERE bucket_id = 'reports'
        AND name = v_report.file_path;
      
      -- Delete metadata
      DELETE FROM public.reports
      WHERE id = v_report.id;
      
      v_deleted_count := v_deleted_count + 1;
      v_freed_bytes := v_freed_bytes + COALESCE(v_report.file_size, 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error deleting report %: %', v_report.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_deleted_count, v_freed_bytes;
END;
$function$;

-- =============================================
-- FUNCTION: Get user's reports list
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_reports(
  p_user_id uuid,
  p_report_type varchar DEFAULT NULL,
  p_year integer DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  report_type varchar,
  title varchar,
  description text,
  period_start date,
  period_end date,
  file_format varchar,
  file_size bigint,
  is_preserved boolean,
  expires_at timestamptz,
  generated_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user is requesting their own reports
  IF p_user_id != auth.uid() AND NOT is_service_role() THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    r.id,
    r.report_type,
    r.title,
    r.description,
    r.period_start,
    r.period_end,
    r.file_format,
    r.file_size,
    r.is_preserved,
    r.expires_at,
    r.generated_at
  FROM public.reports r
  WHERE r.user_id = p_user_id
    AND (p_report_type IS NULL OR r.report_type = p_report_type)
    AND (p_year IS NULL OR EXTRACT(YEAR FROM r.period_start) = p_year)
  ORDER BY r.generated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- =============================================
-- Add updated_at trigger
-- =============================================

CREATE TRIGGER update_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();