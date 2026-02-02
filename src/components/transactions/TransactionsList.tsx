import { useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, Filter, Search, X } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TransactionRow } from "./TransactionRow";
import { useCategories } from "@/hooks/useCategories";
import type { Transaction, TransactionFilters } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";

interface TransactionsListProps {
  transactions: Transaction[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onTransactionClick?: (transaction: Transaction) => void;
}

export function TransactionsList({
  transactions,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  filters,
  onFiltersChange,
  onRefresh,
  isRefreshing,
  onTransactionClick,
}: TransactionsListProps) {
  const { data: categories } = useCategories();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSearchChange = useCallback(
    (value: string) => {
      onFiltersChange({ ...filters, search: value || undefined });
    },
    [filters, onFiltersChange]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        category: value === "all" ? undefined : value,
      });
    },
    [filters, onFiltersChange]
  );

  const handleDatePresetChange = useCallback(
    (preset: string) => {
      const now = new Date();
      let startDate: Date | undefined;

      switch (preset) {
        case "7d":
          startDate = subDays(now, 7);
          break;
        case "30d":
          startDate = subDays(now, 30);
          break;
        case "90d":
          startDate = subDays(now, 90);
          break;
        default:
          startDate = undefined;
      }

      onFiltersChange({
        ...filters,
        startDate,
        endDate: startDate ? now : undefined,
      });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.search ||
    filters.category ||
    filters.startDate ||
    filters.minAmount !== undefined;

  // Group transactions by date
  const groupedTransactions = transactions.reduce(
    (groups, transaction) => {
      const date = format(new Date(transaction.posted_at), "yyyy-MM-dd");
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    },
    {} as Record<string, Transaction[]>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            value={filters.search || ""}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category filter */}
        <Select
          value={filters.category || "all"}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date presets */}
        <Select
          value={
            filters.startDate
              ? `${Math.round(
                  (Date.now() - filters.startDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                )}d`
              : "all"
          }
          onValueChange={handleDatePresetChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        {/* Refresh button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("w-4 h-4", isRefreshing && "animate-spin")}
            />
          </Button>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Transactions list */}
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Filter className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium mb-1">Nenhuma transação encontrada</p>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Tente ajustar os filtros"
              : "As transações aparecerão aqui após a sincronização"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {/* Date header */}
                <p className="text-sm font-medium text-muted-foreground mb-2 px-2">
                  {format(new Date(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>

                {/* Day transactions */}
                <div className="space-y-1 bg-card rounded-xl border p-2">
                  {dayTransactions.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      onClick={onTransactionClick}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {isFetchingNextPage && (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionsList;
