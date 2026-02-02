import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface QuickChip {
  id: string;
  text: string;
  category: string;
}

// Hook for chat sessions
export function useChatSessions(userId?: string) {
  return useQuery({
    queryKey: ["chat-sessions", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as ChatSession[];
    },
    enabled: !!userId,
  });
}

// Hook for chat messages with realtime subscription
export function useChatMessages(sessionId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-messages", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!sessionId,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`chat-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          queryClient.setQueryData(
            ["chat-messages", sessionId],
            (old: ChatMessage[] | undefined) => {
              if (!old) return [payload.new as ChatMessage];
              // Avoid duplicates
              if (old.find((m) => m.id === payload.new.id)) return old;
              return [...old, payload.new as ChatMessage];
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  return query;
}

// Hook for quick chips
export function useQuickChips() {
  return useQuery({
    queryKey: ["quick-chips"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("chat-ai", {
        body: { action: "quick_chips" },
      });

      if (error) throw error;
      return (data?.chips || []) as QuickChip[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// Hook for creating chat sessions
export function useCreateChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, context }: { title?: string; context?: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke("chat-ai", {
        body: { action: "create_session", title, context },
      });

      if (error) throw error;
      return data.session as ChatSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });
}

// Hook for sending messages with streaming
export function useSendMessage(sessionId?: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (message: string) => {
      if (!sessionId || !message.trim()) return;

      setIsStreaming(true);
      setStreamingContent("");

      // Optimistic update: add user message immediately
      const tempUserMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        session_id: sessionId,
        role: "user",
        content: message.trim(),
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData(
        ["chat-messages", sessionId],
        (old: ChatMessage[] | undefined) => [...(old || []), tempUserMessage]
      );

      try {
        abortControllerRef.current = new AbortController();

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "send_message",
              session_id: sessionId,
              message: message.trim(),
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 429) {
            toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
            throw new Error("Rate limit exceeded");
          }
          
          if (response.status === 402) {
            toast.error("Créditos de IA esgotados. Entre em contato com o suporte.");
            throw new Error("Credits exhausted");
          }
          
          throw new Error(errorData.error || "Failed to send message");
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setStreamingContent(fullContent);
              }
            } catch {
              // Incomplete JSON, put back and wait
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        // Invalidate to get the final saved messages
        await queryClient.invalidateQueries({ queryKey: ["chat-messages", sessionId] });
        await queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });

      } catch (error) {
        if ((error as Error).name === "AbortError") {
          console.log("Message sending cancelled");
        } else {
          console.error("Send message error:", error);
          toast.error("Erro ao enviar mensagem. Tente novamente.");
        }
        
        // Remove optimistic message on error
        queryClient.setQueryData(
          ["chat-messages", sessionId],
          (old: ChatMessage[] | undefined) =>
            old?.filter((m) => m.id !== tempUserMessage.id) || []
        );
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortControllerRef.current = null;
      }
    },
    [sessionId, queryClient]
  );

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    sendMessage,
    cancelStreaming,
    isStreaming,
    streamingContent,
  };
}

// Hook to delete a session
export function useDeleteChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
    onError: () => {
      toast.error("Erro ao excluir conversa");
    },
  });
}
