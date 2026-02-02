import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserBalance {
  user_id: string;
  total_balance: number;
  total_available: number;
  account_count: number;
  last_sync: string | null;
}

export function useUserBalance(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-balance", userId],
    queryFn: async (): Promise<UserBalance | null> => {
      if (!userId) return null;

      const { data, error } = await supabase.rpc("get_user_balance", {
        user_uuid: userId,
      });

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return null;

      return data[0] as UserBalance;
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });
}
