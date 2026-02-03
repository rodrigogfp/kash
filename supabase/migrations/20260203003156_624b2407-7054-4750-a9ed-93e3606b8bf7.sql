-- =============================================
-- Plans & Invoices Schema for Billing
-- =============================================

-- 1. Create plans table for subscription tiers
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar NOT NULL UNIQUE,
  display_name varchar NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency varchar NOT NULL DEFAULT 'BRL',
  billing_interval varchar NOT NULL DEFAULT 'monthly', -- monthly, yearly
  limits jsonb NOT NULL DEFAULT '{
    "max_bank_connections": 2,
    "max_chat_messages_per_day": 20,
    "reports_enabled": false,
    "tax_report_enabled": false
  }'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Plans are publicly readable (for pricing page)
CREATE POLICY "plans_select_public"
  ON public.plans FOR SELECT
  USING (is_active = true);

-- Service role can manage plans
CREATE POLICY "plans_all_service"
  ON public.plans FOR ALL
  USING (is_service_role());

-- 2. Add plan_id reference to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id);

-- 3. Create invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_provider_id varchar, -- Stripe invoice ID
  amount_cents integer NOT NULL,
  currency varchar NOT NULL DEFAULT 'BRL',
  status varchar NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  description text,
  pdf_url text, -- URL to invoice PDF from provider
  hosted_invoice_url text, -- Stripe hosted invoice page
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users can view their own invoices
CREATE POLICY "invoices_select_own"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage invoices
CREATE POLICY "invoices_all_service"
  ON public.invoices FOR ALL
  USING (is_service_role());

-- 4. Create payment_methods table (tokenized references only)
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider varchar NOT NULL DEFAULT 'stripe', -- stripe, apple_pay, google_pay
  provider_payment_method_id varchar NOT NULL, -- pm_xxx from Stripe
  type varchar NOT NULL DEFAULT 'card', -- card, bank_account, etc.
  last4 varchar(4),
  brand varchar, -- visa, mastercard, etc.
  exp_month smallint,
  exp_year smallint,
  is_default boolean NOT NULL DEFAULT false,
  billing_details jsonb DEFAULT '{}'::jsonb, -- name, address (no sensitive data)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_payment_method_id)
);

-- Enable RLS on payment_methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment methods
CREATE POLICY "payment_methods_select_own"
  ON public.payment_methods FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own payment methods
CREATE POLICY "payment_methods_delete_own"
  ON public.payment_methods FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage payment methods
CREATE POLICY "payment_methods_all_service"
  ON public.payment_methods FOR ALL
  USING (is_service_role());

-- 5. Insert default plans
INSERT INTO public.plans (slug, display_name, description, price_cents, currency, billing_interval, limits, features, sort_order)
VALUES 
  ('free', 'Grátis', 'Perfeito para começar a organizar suas finanças', 0, 'BRL', 'monthly', 
   '{"max_bank_connections": 2, "max_chat_messages_per_day": 20, "reports_enabled": true, "tax_report_enabled": false}'::jsonb,
   '["Até 2 contas bancárias", "20 mensagens de chat por dia", "Relatórios mensais básicos", "Alertas de gastos"]'::jsonb,
   1),
  ('pro', 'Pro', 'Para quem quer controle total das suas finanças', 2990, 'BRL', 'monthly',
   '{"max_bank_connections": -1, "max_chat_messages_per_day": -1, "reports_enabled": true, "tax_report_enabled": true}'::jsonb,
   '["Contas bancárias ilimitadas", "Chat com IA ilimitado", "Relatório fiscal anual", "Exportação CSV", "Suporte prioritário"]'::jsonb,
   2),
  ('enterprise', 'Enterprise', 'Soluções personalizadas para empresas', 9990, 'BRL', 'monthly',
   '{"max_bank_connections": -1, "max_chat_messages_per_day": -1, "reports_enabled": true, "tax_report_enabled": true}'::jsonb,
   '["Tudo do Pro", "API de integração", "Múltiplos usuários", "Gerente de conta dedicado", "SLA garantido"]'::jsonb,
   3);

-- 6. Create indexes for performance
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_subscription_id ON public.invoices(subscription_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX idx_plans_slug ON public.plans(slug);
CREATE INDEX idx_subscriptions_plan_id ON public.subscriptions(plan_id);

-- 7. Create function to get user's active plan with limits
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'plan_slug', COALESCE(p.slug, 'free'),
    'plan_name', COALESCE(p.display_name, 'Grátis'),
    'limits', COALESCE(p.limits, '{"max_bank_connections": 2, "max_chat_messages_per_day": 20}'::jsonb),
    'features', COALESCE(p.features, '[]'::jsonb),
    'is_premium', COALESCE(s.plan, 'free') != 'free',
    'subscription_status', COALESCE(s.status, 'active'),
    'period_end', s.current_period_end
  ) INTO v_result
  FROM public.users u
  LEFT JOIN public.subscriptions s ON s.user_id = u.id AND s.status = 'active'
  LEFT JOIN public.plans p ON p.id = s.plan_id OR (s.plan_id IS NULL AND p.slug = COALESCE(s.plan, 'free'))
  WHERE u.id = p_user_id;
  
  RETURN COALESCE(v_result, '{"plan_slug": "free", "plan_name": "Grátis", "limits": {"max_bank_connections": 2, "max_chat_messages_per_day": 20}, "features": [], "is_premium": false}'::jsonb);
END;
$$;