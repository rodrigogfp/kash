-- Drop existing restrictive policies and recreate as permissive with proper guards

-- =============================================
-- Helper function to check if current role is service_role
-- =============================================
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('role', true) = 'service_role'
$$;

-- =============================================
-- DROP existing policies
-- =============================================

-- users table
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;

-- user_profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- auth_providers table
DROP POLICY IF EXISTS "Users can view their own auth providers" ON public.auth_providers;

-- audit_events table
DROP POLICY IF EXISTS "Users can view their own audit events" ON public.audit_events;

-- =============================================
-- public.users policies
-- =============================================

-- SELECT: Users can view their own data OR service_role can view all
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_select_service"
  ON public.users FOR SELECT
  TO service_role
  USING (true);

-- INSERT: Service role only (triggered by handle_new_user function)
CREATE POLICY "users_insert_service"
  ON public.users FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE: Users can update their own editable fields
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_service"
  ON public.users FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- DELETE: Service role only
CREATE POLICY "users_delete_service"
  ON public.users FOR DELETE
  TO service_role
  USING (true);

-- =============================================
-- public.user_profiles policies
-- =============================================

-- SELECT: Users can view their own profile
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "user_profiles_select_service"
  ON public.user_profiles FOR SELECT
  TO service_role
  USING (true);

-- INSERT: Service role (via trigger) or user creating their own
CREATE POLICY "user_profiles_insert_service"
  ON public.user_profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own profile
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update_service"
  ON public.user_profiles FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- DELETE: Service role only
CREATE POLICY "user_profiles_delete_service"
  ON public.user_profiles FOR DELETE
  TO service_role
  USING (true);

-- =============================================
-- public.auth_providers policies
-- =============================================

-- SELECT: Users can view their own auth providers
CREATE POLICY "auth_providers_select_own"
  ON public.auth_providers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "auth_providers_select_service"
  ON public.auth_providers FOR SELECT
  TO service_role
  USING (true);

-- INSERT: Users can add their own providers OR service_role
CREATE POLICY "auth_providers_insert_own"
  ON public.auth_providers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auth_providers_insert_service"
  ON public.auth_providers FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE: Service role only (providers shouldn't be updated by users)
CREATE POLICY "auth_providers_update_service"
  ON public.auth_providers FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- DELETE: Users can remove their own providers OR service_role
CREATE POLICY "auth_providers_delete_own"
  ON public.auth_providers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "auth_providers_delete_service"
  ON public.auth_providers FOR DELETE
  TO service_role
  USING (true);

-- =============================================
-- public.audit_events policies
-- =============================================

-- SELECT: Users can view their own non-sensitive audit events
CREATE POLICY "audit_events_select_own"
  ON public.audit_events FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND event_type NOT IN ('password_change', 'mfa_disable', 'account_delete')
  );

CREATE POLICY "audit_events_select_service"
  ON public.audit_events FOR SELECT
  TO service_role
  USING (true);

-- INSERT: Service role only (audit events are system-generated)
CREATE POLICY "audit_events_insert_service"
  ON public.audit_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE: Never allowed (audit trail immutability)
-- No UPDATE policy = no updates allowed

-- DELETE: Service role only (for data retention policies)
CREATE POLICY "audit_events_delete_service"
  ON public.audit_events FOR DELETE
  TO service_role
  USING (true);