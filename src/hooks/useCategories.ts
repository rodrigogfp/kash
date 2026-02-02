import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  created_at: string;
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw new Error(error.message);
      return data as Category[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSpendingByCategory(
  userId: string | undefined,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ["spending-by-category", userId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase.rpc("get_spending_by_category", {
        p_user_id: userId,
        p_start_date: startDate?.toISOString().split("T")[0],
        p_end_date: endDate?.toISOString().split("T")[0],
      });

      if (error) throw new Error(error.message);
      return data as Array<{
        category: string;
        category_id: string | null;
        total_amount: number;
        transaction_count: number;
        percentage: number;
      }>;
    },
    enabled: !!userId,
  });
}

export function useMonthlyTrend(userId: string | undefined, months = 6) {
  return useQuery({
    queryKey: ["monthly-trend", userId, months],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase.rpc("get_monthly_trend", {
        p_user_id: userId,
        p_months: months,
      });

      if (error) throw new Error(error.message);
      return data as Array<{
        month: string;
        income: number;
        expenses: number;
        net: number;
      }>;
    },
    enabled: !!userId,
  });
}
