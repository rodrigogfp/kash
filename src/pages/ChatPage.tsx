import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  useChatSessions,
  useChatMessages,
  useQuickChips,
  useSendMessage,
  useCreateChatSession,
  useDeleteChatSession,
} from "@/hooks/useChat";
import {
  MessageList,
  ChatComposer,
  SuggestedChips,
  SessionList,
} from "@/components/chat";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data fetching
  const { data: sessions = [], isLoading: isLoadingSessions } = useChatSessions(user?.id);
  const { data: messages = [], isLoading: isLoadingMessages } = useChatMessages(selectedSessionId);
  const { data: quickChips = [] } = useQuickChips();
  const { sendMessage, cancelStreaming, isStreaming, streamingContent } = useSendMessage(selectedSessionId);
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();

  // Auto-select first session or create new one
  useEffect(() => {
    if (!isLoadingSessions && sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, isLoadingSessions, selectedSessionId]);

  const handleNewSession = async () => {
    try {
      const session = await createSession.mutateAsync({});
      setSelectedSessionId(session.id);
      setSidebarOpen(false);
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Erro ao criar conversa");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession.mutateAsync(sessionId);
      if (selectedSessionId === sessionId) {
        const remainingSessions = sessions.filter((s) => s.id !== sessionId);
        setSelectedSessionId(remainingSessions[0]?.id);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleSend = async (message: string) => {
    if (!selectedSessionId) {
      // Create a new session if none selected
      try {
        const session = await createSession.mutateAsync({ title: message.slice(0, 50) });
        setSelectedSessionId(session.id);
        // Wait a tick for the session to be set
        setTimeout(() => sendMessage(message), 100);
      } catch (error) {
        console.error("Error creating session:", error);
        toast.error("Erro ao criar conversa");
      }
    } else {
      sendMessage(message);
    }
  };

  const handleQuickChipSelect = (text: string) => {
    handleSend(text);
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSidebarOpen(false);
  };

  // Sidebar content
  const sidebarContent = (
    <SessionList
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      onSelectSession={handleSelectSession}
      onNewSession={handleNewSession}
      onDeleteSession={handleDeleteSession}
      isLoading={isLoadingSessions}
    />
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 border-r bg-card flex-shrink-0">
          {sidebarContent}
        </aside>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b flex items-center gap-3 px-4 bg-card flex-shrink-0">
          {isMobile && (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {sidebarContent}
              </SheetContent>
            </Sheet>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">
              {sessions.find((s) => s.id === selectedSessionId)?.title || "Chat IA"}
            </h1>
          </div>
        </header>

        {/* Messages */}
        <MessageList
          messages={messages}
          isLoading={isLoadingMessages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
        />

        {/* Composer Area */}
        <div className="p-4 border-t bg-card flex-shrink-0">
          {/* Quick Chips - only show when no messages or not streaming */}
          {messages.length === 0 && !isStreaming && (
            <SuggestedChips
              chips={quickChips}
              onSelect={handleQuickChipSelect}
              disabled={isStreaming}
            />
          )}

          <ChatComposer
            onSend={handleSend}
            onCancel={cancelStreaming}
            isLoading={isStreaming}
            disabled={createSession.isPending}
          />
        </div>
      </div>
    </div>
  );
}
