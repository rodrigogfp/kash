import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategorySpending } from "@/hooks/useAnalytics";

interface CategoryBreakdownChartProps {
  data: CategorySpending[] | undefined;
  isLoading: boolean;
  onCategoryClick?: (category: CategorySpending) => void;
  selectedCategory?: string | null;
}

export function CategoryBreakdownChart({
  data,
  isLoading,
  onCategoryClick,
  selectedCategory,
}: CategoryBreakdownChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => ({
      name: item.category || "Uncategorized",
      value: Math.abs(item.total_amount),
      color: item.color,
      percentage: item.percentage,
      count: item.transaction_count,
      original: item,
    }));
  }, [data]);

  const totalSpending = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <Skeleton className="h-[200px] w-[200px] rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
          No spending data for this period
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            R$ {data.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.percentage.toFixed(1)}% • {data.count} transactions
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={(_, index) => {
                  if (onCategoryClick && chartData[index]) {
                    onCategoryClick(chartData[index].original);
                  }
                }}
                style={{ cursor: onCategoryClick ? "pointer" : "default" }}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={selectedCategory === entry.name ? "hsl(var(--foreground))" : "transparent"}
                    strokeWidth={selectedCategory === entry.name ? 3 : 0}
                    opacity={
                      activeIndex === null || activeIndex === index ? 1 : 0.5
                    }
                    className="transition-all duration-200"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '-60px' }}>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              R$ {totalSpending.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {chartData.slice(0, 6).map((item, index) => (
            <button
              key={index}
              onClick={() => onCategoryClick?.(item.original)}
              className={`flex items-center gap-2 p-2 rounded-lg transition-all text-left ${
                selectedCategory === item.name
                  ? "bg-primary/10 ring-1 ring-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.percentage.toFixed(1)}%
                </p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
