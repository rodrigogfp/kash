import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type Plan = Tables<"plans">;

export interface PlanLimits {
  max_bank_connections: number;
  max_chat_messages_per_day: number;
  reports_enabled: boolean;
  tax_report_enabled: boolean;
}

export interface UserPlanInfo {
  plan_slug: string;
  plan_name: string;
  limits: PlanLimits;
  features: string[];
  is_premium: boolean;
  subscription_status: string;
  period_end: string | null;
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      
      if (error) throw error;
      return data as Plan[];
    },
  });
}

export function useUserPlanLimits() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["user-plan-limits", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc("get_user_plan_limits", {
        p_user_id: user.id,
      });
      
      if (error) throw error;
      return data as unknown as UserPlanInfo;
    },
    enabled: !!user?.id,
  });
}

export function useInvoices() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}
