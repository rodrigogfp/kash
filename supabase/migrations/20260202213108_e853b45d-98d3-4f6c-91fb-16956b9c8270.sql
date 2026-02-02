-- Create supported_banks table (catalog of available banks)
CREATE TABLE public.supported_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key varchar NOT NULL UNIQUE,
  display_name varchar NOT NULL,
  logo_url text,
  countries text[] DEFAULT '{}',
  enabled boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create bank_connections table (user authorization instances)
CREATE TABLE public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_key varchar NOT NULL REFERENCES public.supported_banks(provider_key),
  external_connection_id varchar NOT NULL,
  access_token_encrypted text,
  refresh_token_encrypted text,
  scopes text[] DEFAULT '{}',
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error', 'expired')),
  last_sync timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_key, external_connection_id)
);

-- Create bank_accounts table (individual accounts fetched from banks)
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  external_account_id varchar NOT NULL,
  name varchar NOT NULL,
  account_type varchar NOT NULL,
  currency varchar NOT NULL DEFAULT 'BRL',
  current_balance numeric(14,2) DEFAULT 0,
  available_balance numeric(14,2) DEFAULT 0,
  last_balance_update timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_account_id)
);

-- Create sync_jobs table (background sync tracking)
CREATE TABLE public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  job_type varchar NOT NULL CHECK (job_type IN ('full_sync', 'balance_sync', 'transaction_sync', 'token_refresh')),
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for frequent queries
CREATE INDEX idx_bank_connections_user_id ON public.bank_connections(user_id);
CREATE INDEX idx_bank_connections_status ON public.bank_connections(status);
CREATE INDEX idx_bank_accounts_connection_id ON public.bank_accounts(connection_id);
CREATE INDEX idx_sync_jobs_connection_id ON public.sync_jobs(connection_id);
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs(status);
CREATE INDEX idx_sync_jobs_scheduled_at ON public.sync_jobs(scheduled_at) WHERE status = 'pending';

-- Enable RLS on all tables
ALTER TABLE public.supported_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS for supported_banks (public read for enabled banks)
CREATE POLICY "supported_banks_select_public" ON public.supported_banks
  FOR SELECT USING (enabled = true);

CREATE POLICY "supported_banks_all_service" ON public.supported_banks
  FOR ALL USING (public.is_service_role());

-- RLS for bank_connections (user owns their connections)
CREATE POLICY "bank_connections_select_own" ON public.bank_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bank_connections_insert_own" ON public.bank_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bank_connections_update_own" ON public.bank_connections
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bank_connections_delete_own" ON public.bank_connections
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "bank_connections_all_service" ON public.bank_connections
  FOR ALL USING (public.is_service_role());

-- RLS for bank_accounts (access through connection ownership)
CREATE POLICY "bank_accounts_select_own" ON public.bank_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bank_connections bc
      WHERE bc.id = connection_id AND bc.user_id = auth.uid()
    )
  );

CREATE POLICY "bank_accounts_insert_service" ON public.bank_accounts
  FOR INSERT WITH CHECK (public.is_service_role());

CREATE POLICY "bank_accounts_update_service" ON public.bank_accounts
  FOR UPDATE USING (public.is_service_role());

CREATE POLICY "bank_accounts_delete_service" ON public.bank_accounts
  FOR DELETE USING (public.is_service_role());

CREATE POLICY "bank_accounts_all_service" ON public.bank_accounts
  FOR ALL USING (public.is_service_role());

-- RLS for sync_jobs (access through connection ownership)
CREATE POLICY "sync_jobs_select_own" ON public.sync_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bank_connections bc
      WHERE bc.id = connection_id AND bc.user_id = auth.uid()
    )
  );

CREATE POLICY "sync_jobs_all_service" ON public.sync_jobs
  FOR ALL USING (public.is_service_role());

-- Add updated_at triggers
CREATE TRIGGER update_supported_banks_updated_at
  BEFORE UPDATE ON public.supported_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sync_jobs_updated_at
  BEFORE UPDATE ON public.sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();