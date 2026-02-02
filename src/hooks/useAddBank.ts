import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreateLinkTokenResponse {
  success: boolean;
  data?: {
    linkToken: string;
    expiresAt: string;
  };
  error?: string;
}

interface ExchangeTokenResponse {
  success: boolean;
  data?: {
    connectionId: string;
    accountCount: number;
  };
  error?: string;
}

interface RefreshTokensResponse {
  success: boolean;
  data?: {
    success: boolean;
  };
  error?: string;
}

interface InitiateSyncResponse {
  success: boolean;
  data?: {
    jobId: string;
  };
  error?: string;
}

async function callBankOperation<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("bank-operations", {
    body: { action, ...params },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.success) {
    throw new Error(data.error || "Unknown error");
  }

  return data as T;
}

export function useCreateLinkToken() {
  return useMutation({
    mutationFn: async (providerKey: string) => {
      const response = await callBankOperation<CreateLinkTokenResponse>(
        "create_link_token",
        { provider_key: providerKey }
      );
      return response.data!;
    },
    onError: (error) => {
      toast({
        title: "Erro ao iniciar conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useExchangePublicToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ providerKey, publicToken }: { providerKey: string; publicToken: string }) => {
      const response = await callBankOperation<ExchangeTokenResponse>(
        "exchange_public_token",
        { provider_key: providerKey, public_token: publicToken }
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      toast({
        title: "Conta conectada!",
        description: "Sua conta bancária foi conectada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao conectar conta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useRefreshConnectionTokens() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await callBankOperation<RefreshTokensResponse>(
        "refresh_connection_tokens",
        { connection_id: connectionId }
      );
      return response.data!;
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar tokens",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useInitiateSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ connectionId, mode = "incremental" }: { connectionId: string; mode?: "full" | "incremental" }) => {
      const response = await callBankOperation<InitiateSyncResponse>(
        "initiate_sync",
        { connection_id: connectionId, mode }
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      toast({
        title: "Sincronização iniciada",
        description: "Seus dados estão sendo atualizados.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useRevokeConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from("bank_connections")
        .delete()
        .eq("id", connectionId);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      toast({
        title: "Conexão revogada",
        description: "A conexão bancária foi removida.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao revogar conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
