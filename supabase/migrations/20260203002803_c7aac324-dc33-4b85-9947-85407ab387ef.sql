-- =============================================
-- Profile & Security RLS Enhancement
-- =============================================

-- 1. Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table for role management
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  granted_by uuid REFERENCES public.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. RLS Policies for user_roles table
-- Service role can manage all roles
CREATE POLICY "user_roles_all_service"
  ON public.user_roles FOR ALL
  USING (is_service_role());

-- Users can view their own roles
CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "user_roles_select_admin"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can manage roles (except their own admin role for safety)
CREATE POLICY "user_roles_manage_admin"
  ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin') AND user_id != auth.uid());

-- 5. Update bank_access_audit policies to include admin access
CREATE POLICY "bank_access_audit_select_admin"
  ON public.bank_access_audit FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- 6. Update audit_events policies to include admin access (full access, no filtering)
CREATE POLICY "audit_events_select_admin"
  ON public.audit_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- 7. Create notification_settings policies for delete (missing)
CREATE POLICY "notification_settings_delete_own"
  ON public.notification_settings FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Add index for performance on role lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);