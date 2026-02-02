import { memo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/hooks/useTransactions";

interface TransactionRowProps {
  transaction: Transaction;
  onClick?: (transaction: Transaction) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Alimentação": "bg-red-500/10 text-red-600 dark:text-red-400",
  "Transporte": "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  "Moradia": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "Saúde": "bg-green-500/10 text-green-600 dark:text-green-400",
  "Educação": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "Lazer": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "Compras": "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  "Serviços": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Transferência": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "Investimento": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Salário": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  "Outros": "bg-muted text-muted-foreground",
};

function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  onClick,
}: TransactionRowProps) {
  const isIncome = transaction.amount > 0;
  const date = parseISO(transaction.posted_at);
  const category = transaction.category || "Outros";
  const categoryClass = CATEGORY_COLORS[category] || CATEGORY_COLORS["Outros"];

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl transition-colors",
        "hover:bg-muted/50 cursor-pointer",
        "border border-transparent hover:border-border"
      )}
      onClick={() => onClick?.(transaction)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick?.(transaction);
        }
      }}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          isIncome
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-destructive"
        )}
      >
        {isIncome ? (
          <ArrowDownLeft className="w-5 h-5" />
        ) : (
          <ArrowUpRight className="w-5 h-5" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {transaction.merchant_name || transaction.description || "Transação"}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {transaction.description && transaction.merchant_name
            ? transaction.description
            : format(date, "d 'de' MMM, HH:mm", { locale: ptBR })}
        </p>
      </div>

      {/* Category badge */}
      <Badge variant="secondary" className={cn("hidden sm:flex", categoryClass)}>
        {category}
      </Badge>

      {/* Amount */}
      <div className="text-right">
        <p
          className={cn(
            "font-semibold tabular-nums",
            isIncome ? "text-success" : "text-foreground"
          )}
        >
          {isIncome ? "+" : ""}
          {formatCurrency(transaction.amount, transaction.currency)}
        </p>
        <p className="text-xs text-muted-foreground sm:hidden">
          {format(date, "dd/MM", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
});

export default TransactionRow;
