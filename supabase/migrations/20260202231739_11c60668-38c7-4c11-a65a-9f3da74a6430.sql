-- Create chat_sessions table
CREATE TABLE public.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title varchar(255),
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  content_vector real[] NULL,
  tokens int NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create quick_chips table for suggested prompts
CREATE TABLE public.quick_chips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text varchar(255) NOT NULL,
  category varchar(50) NOT NULL DEFAULT 'general',
  ordering int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_created ON public.chat_messages(session_id, created_at DESC);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_quick_chips_category_ordering ON public.quick_chips(category, ordering);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_chips ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_sessions
CREATE POLICY "chat_sessions_select_own" ON public.chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "chat_sessions_insert_own" ON public.chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_sessions_update_own" ON public.chat_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_sessions_delete_own" ON public.chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Helper function to check session ownership
CREATE OR REPLACE FUNCTION public.owns_chat_session(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_sessions
    WHERE id = _session_id AND user_id = auth.uid()
  )
$$;

-- RLS policies for chat_messages (use helper function to avoid recursion)
CREATE POLICY "chat_messages_select_own" ON public.chat_messages
  FOR SELECT USING (owns_chat_session(session_id));

CREATE POLICY "chat_messages_insert_own" ON public.chat_messages
  FOR INSERT WITH CHECK (owns_chat_session(session_id));

CREATE POLICY "chat_messages_delete_own" ON public.chat_messages
  FOR DELETE USING (owns_chat_session(session_id));

-- Service role policies for chat tables
CREATE POLICY "chat_sessions_all_service" ON public.chat_sessions
  FOR ALL USING (is_service_role());

CREATE POLICY "chat_messages_all_service" ON public.chat_messages
  FOR ALL USING (is_service_role());

-- RLS policies for quick_chips (read-only for authenticated users)
CREATE POLICY "quick_chips_select_authenticated" ON public.quick_chips
  FOR SELECT USING (enabled = true);

CREATE POLICY "quick_chips_all_service" ON public.quick_chips
  FOR ALL USING (is_service_role());

-- Add updated_at triggers
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quick_chips_updated_at
  BEFORE UPDATE ON public.quick_chips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default quick chips
INSERT INTO public.quick_chips (text, category, ordering) VALUES
  ('Quanto gastei este mês?', 'spending', 1),
  ('Qual meu saldo total?', 'balance', 2),
  ('Onde estou gastando mais?', 'spending', 3),
  ('Comparar com mês passado', 'trends', 4),
  ('Qual minha maior despesa?', 'spending', 5),
  ('Resumo financeiro do mês', 'summary', 6);

-- Enable realtime for chat_messages (for live chat updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;