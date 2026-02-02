import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type BankConnection = Tables<"bank_connections_safe">;
export type BankAccount = Tables<"bank_accounts">;

export interface BankConnectionWithAccounts extends BankConnection {
  bank_accounts: BankAccount[];
  supported_banks: {
    display_name: string;
    logo_url: string | null;
  } | null;
}

export function useBankConnections(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bank-connections", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("bank_connections_safe")
        .select(`
          *,
          bank_accounts (*),
          supported_banks (display_name, logo_url)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as BankConnectionWithAccounts[];
    },
    enabled: !!userId,
  });

  // Realtime subscription for connection updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`bank-connections-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bank_connections",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ["bank-connections", userId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bank_accounts",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["bank-connections", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}
