import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PeriodSelector,
  CategoryBreakdownChart,
  TimeSeriesChart,
  DrillDownPanel,
  SummaryCards,
} from "@/components/analytics";
import {
  useAnalyticsOverview,
  type PeriodType,
  type CategorySpending,
} from "@/hooks/useAnalytics";
import { useDebounce } from "@/hooks/useDebounce";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<PeriodType>("month");
  const [compare, setCompare] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategorySpending | null>(null);

  // Debounce period changes to avoid excessive API calls
  const debouncedPeriod = useDebounce(period, 300);

  const {
    summary,
    comparison,
    spending,
    trend,
    currentRange,
    isLoading,
    refetch,
  } = useAnalyticsOverview(debouncedPeriod, compare);

  const handleCategoryClick = useCallback((category: CategorySpending) => {
    setSelectedCategory((prev) =>
      prev?.category === category.category ? null : category
    );
  }, []);

  const handleCloseDrillDown = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-subtle border-b border-border/50">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Analytics</h1>
                <p className="text-sm text-muted-foreground">
                  Track your spending patterns
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetch}
              disabled={isLoading}
              className="rounded-full"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Period Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <PeriodSelector
            period={period}
            onPeriodChange={setPeriod}
            compare={compare}
            onCompareChange={setCompare}
          />
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <SummaryCards
            summary={summary}
            comparison={comparison}
            isLoading={isLoading}
            showComparison={compare}
          />
        </motion.div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="relative"
          >
            <CategoryBreakdownChart
              data={spending}
              isLoading={isLoading}
              onCategoryClick={handleCategoryClick}
              selectedCategory={selectedCategory?.category}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <TimeSeriesChart data={trend} isLoading={isLoading} />
          </motion.div>
        </div>
      </main>

      {/* Drill-down Panel */}
      <DrillDownPanel
        category={selectedCategory}
        periodRange={currentRange}
        onClose={handleCloseDrillDown}
      />
    </div>
  );
}
