import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

export type Report = Tables<"reports">;

export type ReportType = "monthly" | "annual" | "tax" | "export";
export type ReportFormat = "pdf" | "csv";
export type ReportStatus = "pending" | "processing" | "ready" | "failed";

interface GenerateReportParams {
  report_type: ReportType;
  period_start: string;
  period_end: string;
  file_format?: ReportFormat;
  title?: string;
}

interface GenerateReportResponse {
  success: boolean;
  report_id: string;
  status: ReportStatus;
  message: string;
}

interface SignedUrlResponse {
  success: boolean;
  signed_url?: string;
  expires_at?: string;
  error?: string;
}

export function useReports(options?: { limit?: number; reportType?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["reports", user?.id, options?.reportType, options?.limit],
    queryFn: async () => {
      if (!user) return [];

      let queryBuilder = supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (options?.reportType) {
        queryBuilder = queryBuilder.eq("report_type", options.reportType);
      }

      if (options?.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as Report[];
    },
    enabled: !!user,
  });

  // Subscribe to realtime updates for reports
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("reports-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reports",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[useReports] Realtime update:", payload);
          
          if (payload.eventType === "INSERT") {
            queryClient.setQueryData(
              ["reports", user.id, options?.reportType, options?.limit],
              (old: Report[] | undefined) => {
                const newReport = payload.new as Report;
                if (!old) return [newReport];
                return [newReport, ...old];
              }
            );
          } else if (payload.eventType === "UPDATE") {
            queryClient.setQueryData(
              ["reports", user.id, options?.reportType, options?.limit],
              (old: Report[] | undefined) => {
                if (!old) return old;
                const updated = payload.new as Report;
                return old.map((r) => (r.id === updated.id ? updated : r));
              }
            );

            // Show toast when report is ready
            const updated = payload.new as Report;
            if (updated.status === "ready") {
              toast({
                title: "Relatório pronto!",
                description: `"${updated.title}" está disponível para download.`,
              });
            } else if (updated.status === "failed") {
              toast({
                title: "Erro na geração",
                description: updated.error_message || "Falha ao gerar relatório.",
                variant: "destructive",
              });
            }
          } else if (payload.eventType === "DELETE") {
            queryClient.setQueryData(
              ["reports", user.id, options?.reportType, options?.limit],
              (old: Report[] | undefined) => {
                if (!old) return old;
                const deleted = payload.old as Report;
                return old.filter((r) => r.id !== deleted.id);
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, options?.reportType, options?.limit]);

  return query;
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: GenerateReportParams): Promise<GenerateReportResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Não autenticado");
      }

      const response = await supabase.functions.invoke("generate-report", {
        body: {
          action: "generate",
          ...params,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao gerar relatório");
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Falha na geração do relatório");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports", user?.id] });
      toast({
        title: "Relatório em processamento",
        description: "Você será notificado quando estiver pronto.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useReportDownload() {
  return useMutation({
    mutationFn: async (reportId: string): Promise<string> => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Não autenticado");
      }

      const response = await supabase.functions.invoke("generate-report", {
        body: {
          action: "get_signed_url",
          report_id: reportId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao obter URL de download");
      }

      const data = response.data as SignedUrlResponse;
      if (!data?.success || !data.signed_url) {
        throw new Error(data?.error || "URL não disponível");
      }

      return data.signed_url;
    },
    onSuccess: (url) => {
      // Open download in new tab
      window.open(url, "_blank");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no download",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("reports")
        .delete()
        .eq("id", reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports", user?.id] });
      toast({
        title: "Relatório excluído",
        description: "O relatório foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
