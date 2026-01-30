-- Enable pgcrypto extension for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create public.users table (mirrors auth.users id)
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  full_name VARCHAR,
  preferred_name VARCHAR,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index on email
CREATE UNIQUE INDEX idx_users_email ON public.users(email);

-- Create public.user_profiles table (one-to-one with users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  onboarding_step SMALLINT DEFAULT 0, -- 0 = not started, 1..N steps
  onboarding_completed BOOLEAN DEFAULT false,
  biometric_enabled BOOLEAN DEFAULT false,
  timezone VARCHAR,
  locale VARCHAR,
  metadata JSONB DEFAULT '{}', -- for extensible fields (MFA, SSO, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on onboarding_completed for faster queries
CREATE INDEX idx_user_profiles_onboarding_completed ON public.user_profiles(onboarding_completed);

-- Create public.auth_providers table (OAuth providers tracking)
CREATE TABLE public.auth_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL, -- 'google', 'apple', etc.
  provider_user_id VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index on provider + provider_user_id
CREATE UNIQUE INDEX idx_auth_providers_provider_user ON public.auth_providers(provider, provider_user_id);

-- Create index on user_id for faster lookups
CREATE INDEX idx_auth_providers_user_id ON public.auth_providers(user_id);

-- Create public.audit_events table for auth-related events
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type VARCHAR NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on user_id and event_type for faster queries
CREATE INDEX idx_audit_events_user_id ON public.audit_events(user_id);
CREATE INDEX idx_audit_events_event_type ON public.audit_events(event_type);
CREATE INDEX idx_audit_events_created_at ON public.audit_events(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_auth_providers_updated_at
  BEFORE UPDATE ON public.auth_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public.users
CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for public.user_profiles
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for public.auth_providers
CREATE POLICY "Users can view their own auth providers"
  ON public.auth_providers FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for public.audit_events
CREATE POLICY "Users can view their own audit events"
  ON public.audit_events FOR SELECT
  USING (auth.uid() = user_id);

-- Function to handle new user creation from auth.users
-- This will be triggered by a separate trigger (defined in triggers task)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Insert into public.user_profiles
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  
  -- Log audit event
  INSERT INTO public.audit_events (user_id, event_type, payload)
  VALUES (NEW.id, 'user_created', jsonb_build_object('email', NEW.email, 'provider', NEW.raw_app_meta_data->>'provider'));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on auth.users to automatically create public.users and user_profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();