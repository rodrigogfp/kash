import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PeriodSummary, PeriodComparison } from "@/hooks/useAnalytics";

interface SummaryCardsProps {
  summary: PeriodSummary | null | undefined;
  comparison: PeriodComparison | null | undefined;
  isLoading: boolean;
  showComparison: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  change?: number;
  changeLabel?: string;
  isLoading?: boolean;
  valueColor?: string;
}

function StatCard({
  title,
  value,
  icon,
  iconBg,
  change,
  changeLabel,
  isLoading,
  valueColor = "text-foreground",
}: StatCardProps) {
  const isPositiveChange = change !== undefined && change >= 0;

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-20 mt-3" />
          <Skeleton className="h-6 w-28 mt-1" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
          {change !== undefined && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                isPositiveChange
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {isPositiveChange ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {formatPercent(change)}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-3">{title}</p>
        <p className={`text-2xl font-bold ${valueColor}`}>
          R$ {formatCurrency(value)}
        </p>
        {changeLabel && (
          <p className="text-xs text-muted-foreground mt-1">{changeLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function SummaryCards({
  summary,
  comparison,
  isLoading,
  showComparison,
}: SummaryCardsProps) {
  const incomeChange = showComparison
    ? comparison?.changes?.income_percent
    : undefined;
  const expensesChange = showComparison
    ? comparison?.changes?.expenses_percent
    : undefined;
  const netChange = showComparison
    ? comparison?.changes?.net_percent
    : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        title="Income"
        value={summary?.total_income || 0}
        icon={<TrendingUp className="h-5 w-5 text-success" />}
        iconBg="bg-success/10"
        change={incomeChange}
        isLoading={isLoading}
        valueColor="text-success"
      />
      <StatCard
        title="Expenses"
        value={Math.abs(summary?.total_expenses || 0)}
        icon={<TrendingDown className="h-5 w-5 text-destructive" />}
        iconBg="bg-destructive/10"
        change={expensesChange !== undefined ? -expensesChange : undefined}
        isLoading={isLoading}
        valueColor="text-destructive"
      />
      <StatCard
        title="Net Balance"
        value={summary?.net || 0}
        icon={<Wallet className="h-5 w-5 text-primary" />}
        iconBg="bg-primary/10"
        change={netChange}
        isLoading={isLoading}
        valueColor={
          (summary?.net || 0) >= 0 ? "text-success" : "text-destructive"
        }
      />
    </div>
  );
}
