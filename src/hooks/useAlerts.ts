import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Alert = Tables<"alerts">;

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType = 
  | "anomaly" 
  | "bill_due" 
  | "low_balance" 
  | "goal_progress" 
  | "large_transaction"
  | "sync_error";

export function useAlerts(userId?: string, options?: { unreadOnly?: boolean; severity?: AlertSeverity }) {
  return useQuery({
    queryKey: ["alerts", userId, options],
    queryFn: async () => {
      if (!userId) return [];
      
      let query = supabase
        .from("alerts")
        .select("*")
        .eq("user_id", userId)
        .eq("dismissed", false)
        .order("created_at", { ascending: false });
      
      if (options?.unreadOnly) {
        query = query.eq("seen", false);
      }
      
      if (options?.severity) {
        query = query.eq("severity", options.severity);
      }
      
      // Filter expired alerts
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Alert[];
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds for near real-time updates
  });
}

export function useUnreadAlertsCount(userId?: string) {
  return useQuery({
    queryKey: ["alerts-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      const { data, error } = await supabase
        .rpc("get_unread_alerts_count", { p_user_id: userId });
      
      if (error) throw error;
      return data as number;
    },
    enabled: !!userId,
    refetchInterval: 15000, // Refetch more frequently for badge
  });
}

export function useMarkAlertAsSeen() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ alertId, userId }: { alertId: string; userId: string }) => {
      const { error } = await supabase
        .from("alerts")
        .update({ seen: true })
        .eq("id", alertId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alerts", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["alerts-count", variables.userId] });
    },
  });
}

export function useMarkAllAlertsSeen() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("alerts")
        .update({ seen: true })
        .eq("user_id", userId)
        .eq("seen", false);
      
      if (error) throw error;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["alerts", userId] });
      queryClient.invalidateQueries({ queryKey: ["alerts-count", userId] });
    },
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ alertId, userId }: { alertId: string; userId: string }) => {
      const { error } = await supabase
        .from("alerts")
        .update({ dismissed: true })
        .eq("id", alertId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alerts", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["alerts-count", variables.userId] });
    },
  });
}

export function useDismissAllAlerts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("alerts")
        .update({ dismissed: true })
        .eq("user_id", userId)
        .eq("dismissed", false);
      
      if (error) throw error;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["alerts", userId] });
      queryClient.invalidateQueries({ queryKey: ["alerts-count", userId] });
    },
  });
}

// Get urgent alerts for dashboard (critical severity, unseen)
export function useUrgentAlerts(userId?: string, limit = 3) {
  return useQuery({
    queryKey: ["urgent-alerts", userId, limit],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", userId)
        .eq("dismissed", false)
        .eq("seen", false)
        .in("severity", ["critical", "warning"])
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as Alert[];
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });
}
