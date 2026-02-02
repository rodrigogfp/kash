import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingDown, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConnectionTransactions } from "@/hooks/useTransactions";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CategorySpending, PeriodRange } from "@/hooks/useAnalytics";

interface DrillDownPanelProps {
  category: CategorySpending | null;
  periodRange: PeriodRange;
  onClose: () => void;
}

export function DrillDownPanel({
  category,
  periodRange,
  onClose,
}: DrillDownPanelProps) {
  const { user } = useAuth();
  const { data: connections } = useBankConnections(user?.id);
  const connectionId = connections?.[0]?.id;

  // Fetch transactions filtered by category
  const { transactions, isLoading, fetchNextPage, hasNextPage } =
    useConnectionTransactions(connectionId ?? undefined, {
      category: category?.category || undefined,
      startDate: periodRange.start,
      endDate: periodRange.end,
    }, !!category && !!connectionId);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <AnimatePresence>
      {category && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-y-0 right-0 w-full sm:w-96 z-50"
        >
          {/* Backdrop for mobile */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm sm:hidden"
            onClick={onClose}
          />

          <Card className="glass-strong h-full rounded-none sm:rounded-l-2xl border-l">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <CardTitle className="text-lg">
                  {category.category || "Uncategorized"}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="pb-0">
              {/* Category Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold text-foreground">
                    R${" "}
                    {Math.abs(category.total_amount).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-xl font-bold text-foreground">
                    {category.transaction_count}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Transactions
                </h4>
                <span className="text-xs text-muted-foreground">
                  {format(periodRange.start, "dd MMM", { locale: ptBR })} -{" "}
                  {format(periodRange.end, "dd MMM", { locale: ptBR })}
                </span>
              </div>

              <ScrollArea className="h-[calc(100vh-320px)]">
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </div>
                ) : (
                  <div className="space-y-2 pr-4">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-full ${
                              tx.amount < 0
                                ? "bg-destructive/10"
                                : "bg-success/10"
                            }`}
                          >
                            {tx.amount < 0 ? (
                              <TrendingDown className="h-4 w-4 text-destructive" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-success" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {tx.merchant_name || tx.description || "Transaction"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(tx.posted_at), "dd MMM, HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-medium text-sm whitespace-nowrap ${
                            tx.amount < 0
                              ? "text-destructive"
                              : "text-success"
                          }`}
                        >
                          {tx.amount < 0 ? "-" : "+"}R${" "}
                          {Math.abs(tx.amount).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ))}

                    {hasNextPage && (
                      <Button
                        variant="ghost"
                        className="w-full mt-2"
                        onClick={() => fetchNextPage()}
                      >
                        Load more
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
