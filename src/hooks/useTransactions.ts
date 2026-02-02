import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Transaction {
  id: string;
  account_id: string;
  external_transaction_id: string;
  amount: number;
  currency: string;
  posted_at: string;
  transaction_date: string | null;
  description: string | null;
  merchant_name: string | null;
  category: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

const PAGE_SIZE = 50;

export function useAccountTransactions(
  accountId: string | undefined,
  filters: TransactionFilters = {},
  enabled = true
) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["transactions", accountId, filters],
    queryFn: async ({ pageParam = 0 }) => {
      if (!accountId) return { data: [], nextPage: null };

      let queryBuilder = supabase
        .from("transactions")
        .select("*")
        .eq("account_id", accountId)
        .order("posted_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (filters.startDate) {
        queryBuilder = queryBuilder.gte("posted_at", filters.startDate.toISOString());
      }
      if (filters.endDate) {
        queryBuilder = queryBuilder.lte("posted_at", filters.endDate.toISOString());
      }
      if (filters.category) {
        queryBuilder = queryBuilder.eq("category", filters.category);
      }
      if (filters.search) {
        queryBuilder = queryBuilder.or(
          `description.ilike.%${filters.search}%,merchant_name.ilike.%${filters.search}%`
        );
      }
      if (filters.minAmount !== undefined) {
        queryBuilder = queryBuilder.gte("amount", filters.minAmount);
      }
      if (filters.maxAmount !== undefined) {
        queryBuilder = queryBuilder.lte("amount", filters.maxAmount);
      }

      const { data, error } = await queryBuilder;

      if (error) throw new Error(error.message);

      return {
        data: data as Transaction[],
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!accountId && enabled,
  });

  // Realtime subscription
  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`transactions-${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["transactions", accountId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  const allTransactions = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.data) ?? [];
  }, [query.data]);

  return {
    ...query,
    transactions: allTransactions,
  };
}

export function useConnectionTransactions(
  connectionId: string | undefined,
  filters: TransactionFilters = {},
  enabled = true
) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["connection-transactions", connectionId, filters],
    queryFn: async ({ pageParam = 0 }) => {
      if (!connectionId) return { data: [], nextPage: null };

      // First get account IDs for this connection
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("connection_id", connectionId);

      if (!accounts || accounts.length === 0) {
        return { data: [], nextPage: null };
      }

      const accountIds = accounts.map((a) => a.id);

      let queryBuilder = supabase
        .from("transactions")
        .select("*")
        .in("account_id", accountIds)
        .order("posted_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (filters.startDate) {
        queryBuilder = queryBuilder.gte("posted_at", filters.startDate.toISOString());
      }
      if (filters.endDate) {
        queryBuilder = queryBuilder.lte("posted_at", filters.endDate.toISOString());
      }
      if (filters.category) {
        queryBuilder = queryBuilder.eq("category", filters.category);
      }
      if (filters.search) {
        queryBuilder = queryBuilder.or(
          `description.ilike.%${filters.search}%,merchant_name.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await queryBuilder;

      if (error) throw new Error(error.message);

      return {
        data: data as Transaction[],
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!connectionId && enabled,
  });

  // Realtime subscription
  useEffect(() => {
    if (!connectionId) return;

    const channel = supabase
      .channel(`connection-transactions-${connectionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["connection-transactions", connectionId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connectionId, queryClient]);

  const allTransactions = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.data) ?? [];
  }, [query.data]);

  return {
    ...query,
    transactions: allTransactions,
  };
}
