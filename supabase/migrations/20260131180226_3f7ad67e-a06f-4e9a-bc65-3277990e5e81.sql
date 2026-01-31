-- Add archived column for soft-delete
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Create index for archived filter
CREATE INDEX IF NOT EXISTS idx_users_archived ON public.users(archived) WHERE archived = false;

-- Enhanced sync function handling INSERT, UPDATE, DELETE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Handle DELETE (soft-delete)
  IF TG_OP = 'DELETE' THEN
    BEGIN
      UPDATE public.users 
      SET archived = true, archived_at = now(), updated_at = now()
      WHERE id = OLD.id;
      
      INSERT INTO public.audit_events (user_id, event_type, payload)
      VALUES (OLD.id, 'user_deleted', jsonb_build_object('email', OLD.email));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to soft-delete user %: %', OLD.id, SQLERRM;
    END;
    RETURN OLD;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    BEGIN
      UPDATE public.users 
      SET 
        email = NEW.email,
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', full_name),
        avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar_url),
        updated_at = now()
      WHERE id = NEW.id;
      
      -- Log email change
      IF OLD.email IS DISTINCT FROM NEW.email THEN
        INSERT INTO public.audit_events (user_id, event_type, payload)
        VALUES (NEW.id, 'email_changed', jsonb_build_object('old_email', OLD.email, 'new_email', NEW.email));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    BEGIN
      INSERT INTO public.users (id, email, full_name, avatar_url)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
      );
      
      INSERT INTO public.user_profiles (id)
      VALUES (NEW.id);
      
      INSERT INTO public.audit_events (user_id, event_type, payload)
      VALUES (NEW.id, 'user_created', jsonb_build_object('email', NEW.email, 'provider', NEW.raw_app_meta_data->>'provider'));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;

-- Create trigger on auth.users (Supabase allows this via migration)
DROP TRIGGER IF EXISTS on_auth_user_sync ON auth.users;
CREATE TRIGGER on_auth_user_sync
  AFTER INSERT OR UPDATE OR DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();