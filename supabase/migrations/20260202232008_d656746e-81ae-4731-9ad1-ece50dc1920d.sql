-- Add soft-delete column to chat_messages
ALTER TABLE public.chat_messages 
ADD COLUMN deleted_at timestamptz NULL;

-- Create index for filtering deleted messages
CREATE INDEX idx_chat_messages_deleted ON public.chat_messages(deleted_at) WHERE deleted_at IS NULL;

-- Drop the user DELETE policy (keep service role delete)
DROP POLICY IF EXISTS "chat_messages_delete_own" ON public.chat_messages;

-- Add UPDATE policy for soft-delete (users can only set deleted_at)
CREATE POLICY "chat_messages_soft_delete_own" ON public.chat_messages
  FOR UPDATE 
  USING (owns_chat_session(session_id))
  WITH CHECK (
    owns_chat_session(session_id) 
    AND deleted_at IS NOT NULL  -- Only allow setting deleted_at
  );

-- Update SELECT policy to exclude soft-deleted messages for users
DROP POLICY IF EXISTS "chat_messages_select_own" ON public.chat_messages;
CREATE POLICY "chat_messages_select_own" ON public.chat_messages
  FOR SELECT USING (
    owns_chat_session(session_id) 
    AND deleted_at IS NULL
  );

-- Service role can still see all messages (for auditing)
DROP POLICY IF EXISTS "chat_messages_all_service" ON public.chat_messages;
CREATE POLICY "chat_messages_all_service" ON public.chat_messages
  FOR ALL USING (is_service_role());