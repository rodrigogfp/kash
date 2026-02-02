import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TrendData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface TimeSeriesChartProps {
  data: TrendData[] | undefined;
  isLoading: boolean;
  showBrush?: boolean;
}

export function TimeSeriesChart({
  data,
  isLoading,
  showBrush = true,
}: TimeSeriesChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      ...item,
      month: format(parseISO(item.month + "-01"), "MMM yy", { locale: ptBR }),
      income: Number(item.income) || 0,
      expenses: Math.abs(Number(item.expenses)) || 0,
      net: Number(item.net) || 0,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Spending Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">Spending Over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
          No trend data available
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground capitalize">
                {entry.dataKey === "income"
                  ? "Income"
                  : entry.dataKey === "expenses"
                  ? "Expenses"
                  : "Net"}
                :
              </span>
              <span className="font-medium">
                R$ {entry.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">Spending Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(142, 70%, 45%)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(142, 70%, 45%)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(0, 72%, 51%)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(0, 72%, 51%)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(200, 70%, 50%)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(200, 70%, 50%)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(value) =>
                  value >= 1000
                    ? `R$${(value / 1000).toFixed(0)}k`
                    : `R$${value}`
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) =>
                  value === "income"
                    ? "Income"
                    : value === "expenses"
                    ? "Expenses"
                    : "Net"
                }
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(142, 70%, 45%)"
                strokeWidth={2}
                fill="url(#colorIncome)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(0, 72%, 51%)"
                strokeWidth={2}
                fill="url(#colorExpenses)"
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="hsl(200, 70%, 50%)"
                strokeWidth={2}
                fill="url(#colorNet)"
              />
              {showBrush && chartData.length > 3 && (
                <Brush
                  dataKey="month"
                  height={30}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--muted))"
                  travellerWidth={10}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
