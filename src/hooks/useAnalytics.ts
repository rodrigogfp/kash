import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  subYears,
  format,
} from "date-fns";

export type PeriodType = "week" | "month" | "year";

export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface CategorySpending {
  category: string;
  category_id: string | null;
  total_amount: number;
  transaction_count: number;
  percentage: number;
  color?: string;
}

export interface PeriodSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  transaction_count: number;
  by_category: CategorySpending[];
}

export interface PeriodComparison {
  current: PeriodSummary;
  previous: PeriodSummary;
  changes: {
    income_change: number;
    income_percent: number;
    expenses_change: number;
    expenses_percent: number;
    net_change: number;
    net_percent: number;
  };
}

// Chart colors that work with our design system
export const CATEGORY_COLORS = [
  "hsl(150, 40%, 40%)", // primary green
  "hsl(200, 70%, 50%)", // blue
  "hsl(280, 60%, 55%)", // purple
  "hsl(340, 70%, 55%)", // pink
  "hsl(45, 90%, 50%)",  // yellow
  "hsl(15, 80%, 55%)",  // orange
  "hsl(180, 50%, 45%)", // teal
  "hsl(320, 60%, 50%)", // magenta
  "hsl(100, 50%, 45%)", // lime
  "hsl(250, 60%, 60%)", // indigo
];

export function getPeriodRange(period: PeriodType, referenceDate = new Date()): PeriodRange {
  switch (period) {
    case "week":
      return {
        start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
        end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
      };
    case "month":
      return {
        start: startOfMonth(referenceDate),
        end: endOfMonth(referenceDate),
      };
    case "year":
      return {
        start: startOfYear(referenceDate),
        end: endOfYear(referenceDate),
      };
  }
}

export function getPreviousPeriodRange(period: PeriodType, referenceDate = new Date()): PeriodRange {
  switch (period) {
    case "week":
      return getPeriodRange("week", subWeeks(referenceDate, 1));
    case "month":
      return getPeriodRange("month", subMonths(referenceDate, 1));
    case "year":
      return getPeriodRange("year", subYears(referenceDate, 1));
  }
}

export function usePeriodSummary(period: PeriodType, enabled = true) {
  const { user } = useAuth();
  const range = useMemo(() => getPeriodRange(period), [period]);

  return useQuery({
    queryKey: ["period-summary", user?.id, period, range.start.toISOString()],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc("get_period_summary", {
        p_user_id: user.id,
        p_start_date: format(range.start, "yyyy-MM-dd"),
        p_end_date: format(range.end, "yyyy-MM-dd"),
      });

      if (error) throw new Error(error.message);

      const result = data?.[0];
      if (!result) {
        return {
          total_income: 0,
          total_expenses: 0,
          net: 0,
          transaction_count: 0,
          by_category: [],
        } as PeriodSummary;
      }

      // Add colors to categories
      const rawCategories = result.by_category as unknown;
      const categoryArray = Array.isArray(rawCategories) ? rawCategories : [];
      const byCategory = categoryArray.map(
        (cat: CategorySpending, index: number) => ({
          ...cat,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        })
      );

      return {
        total_income: Number(result.total_income) || 0,
        total_expenses: Number(result.total_expenses) || 0,
        net: Number(result.net) || 0,
        transaction_count: Number(result.transaction_count) || 0,
        by_category: byCategory,
      } as PeriodSummary;
    },
    enabled: !!user?.id && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

export function usePeriodComparison(period: PeriodType, enabled = true) {
  const { user } = useAuth();
  const currentRange = useMemo(() => getPeriodRange(period), [period]);
  const previousRange = useMemo(() => getPreviousPeriodRange(period), [period]);

  return useQuery({
    queryKey: [
      "period-comparison",
      user?.id,
      period,
      currentRange.start.toISOString(),
    ],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc("compute_period_comparison", {
        p_user_id: user.id,
        p_base_start: format(currentRange.start, "yyyy-MM-dd"),
        p_base_end: format(currentRange.end, "yyyy-MM-dd"),
        p_compare_start: format(previousRange.start, "yyyy-MM-dd"),
        p_compare_end: format(previousRange.end, "yyyy-MM-dd"),
      });

      if (error) throw new Error(error.message);
      return data as unknown as PeriodComparison | null;
    },
    enabled: !!user?.id && enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useMonthlyTrend(months = 6) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["monthly-trend", user?.id, months],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.rpc("get_monthly_trend", {
        p_user_id: user.id,
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
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSpendingByCategory(period: PeriodType) {
  const { user } = useAuth();
  const range = useMemo(() => getPeriodRange(period), [period]);

  return useQuery({
    queryKey: ["spending-by-category", user?.id, period, range.start.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase.rpc("get_spending_by_category", {
        p_user_id: user.id,
        p_start_date: format(range.start, "yyyy-MM-dd"),
        p_end_date: format(range.end, "yyyy-MM-dd"),
      });

      if (error) throw new Error(error.message);

      return (data || []).map((item, index) => ({
        ...item,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      })) as CategorySpending[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAnalyticsOverview(period: PeriodType, compare = false) {
  const summary = usePeriodSummary(period);
  const comparison = usePeriodComparison(period, compare);
  const spending = useSpendingByCategory(period);
  const trend = useMonthlyTrend(6);

  const currentRange = useMemo(() => getPeriodRange(period), [period]);
  const previousRange = useMemo(() => getPreviousPeriodRange(period), [period]);

  return {
    summary: summary.data,
    comparison: comparison.data,
    spending: spending.data,
    trend: trend.data,
    currentRange,
    previousRange,
    isLoading: summary.isLoading || comparison.isLoading || spending.isLoading || trend.isLoading,
    isError: summary.isError || comparison.isError || spending.isError || trend.isError,
    refetch: useCallback(() => {
      summary.refetch();
      comparison.refetch();
      spending.refetch();
      trend.refetch();
    }, [summary, comparison, spending, trend]),
  };
}
