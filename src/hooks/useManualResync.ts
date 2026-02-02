import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResyncResult {
  jobId: string;
  message: string;
}

interface SyncStatus {
  status: string;
  jobType: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  attempts: number;
}

export function useManualResync(connectionId: string | undefined) {
  const queryClient = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const resyncMutation = useMutation({
    mutationFn: async (): Promise<ResyncResult> => {
      if (!connectionId) throw new Error("Connection ID required");

      const { data, error } = await supabase.functions.invoke("bank-operations", {
        body: {
          action: "start_manual_resync",
          connection_id: connectionId,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to start resync");

      return data.data as ResyncResult;
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      toast.success("Sincronização iniciada");
    },
    onError: (error: Error) => {
      if (error.message.includes("Rate limit")) {
        toast.error("Limite de sincronizações atingido. Tente novamente em 1 hora.");
      } else {
        toast.error(`Erro ao sincronizar: ${error.message}`);
      }
    },
  });

  const syncTransactionsMutation = useMutation({
    mutationFn: async (params?: { fromDate?: string; toDate?: string }) => {
      if (!connectionId) throw new Error("Connection ID required");

      const { data, error } = await supabase.functions.invoke("bank-operations", {
        body: {
          action: "sync_transactions",
          connection_id: connectionId,
          from_date: params?.fromDate,
          to_date: params?.toDate,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to sync transactions");

      return data.data as { jobId: string; transactionCount: number };
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      toast.success(`${data.transactionCount} transações sincronizadas`);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["connection-transactions", connectionId] });
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });

  // Poll for job status when there's an active job
  const statusQuery = useQuery({
    queryKey: ["sync-status", activeJobId],
    queryFn: async (): Promise<SyncStatus> => {
      if (!activeJobId) throw new Error("No active job");

      const { data, error } = await supabase.functions.invoke("bank-operations", {
        body: {
          action: "get_sync_status",
          job_id: activeJobId,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to get status");

      return data.data as SyncStatus;
    },
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling when job is done
      if (status === "finished" || status === "failed") {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Clear active job when done
  const clearJob = useCallback(() => {
    setActiveJobId(null);
  }, []);

  // Handle job completion
  const jobStatus = statusQuery.data?.status;
  if (jobStatus === "finished" || jobStatus === "failed") {
    if (jobStatus === "finished") {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
    }
  }

  return {
    startResync: resyncMutation.mutate,
    syncTransactions: syncTransactionsMutation.mutate,
    isResyncing: resyncMutation.isPending || syncTransactionsMutation.isPending,
    activeJobId,
    jobStatus: statusQuery.data,
    isPolling: statusQuery.isFetching && !!activeJobId,
    clearJob,
    error: resyncMutation.error || syncTransactionsMutation.error,
  };
}
