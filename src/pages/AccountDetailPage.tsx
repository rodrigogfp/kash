import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  RefreshCw,
  Wallet,
  TrendingUp,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TransactionsList } from "@/components/transactions";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useConnectionTransactions, TransactionFilters } from "@/hooks/useTransactions";
import { useManualResync } from "@/hooks/useManualResync";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

export default function AccountDetailPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState<TransactionFilters>({});

  const { data: connections, isLoading: isLoadingConnections } = useBankConnections(user?.id);
  const connection = connections?.find((c) => c.id === connectionId);

  const {
    transactions,
    isLoading: isLoadingTransactions,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useConnectionTransactions(connectionId, filters);

  const {
    syncTransactions,
    isResyncing,
    jobStatus,
    isPolling,
  } = useManualResync(connectionId);

  const handleRefresh = useCallback(() => {
    syncTransactions({});
  }, [syncTransactions]);

  const handleFiltersChange = useCallback((newFilters: TransactionFilters) => {
    setFilters(newFilters);
  }, []);

  if (isLoadingConnections) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Conta não encontrada</h2>
          <Button variant="outline" onClick={() => navigate("/accounts")}>
            Voltar para contas
          </Button>
        </div>
      </div>
    );
  }

  const totalBalance = connection.bank_accounts?.reduce(
    (sum, acc) => sum + (acc.current_balance || 0),
    0
  ) || 0;

  const totalAvailable = connection.bank_accounts?.reduce(
    (sum, acc) => sum + (acc.available_balance || 0),
    0
  ) || 0;

  const accountCount = connection.bank_accounts?.length || 0;
  const bankName = connection.supported_banks?.display_name || connection.provider_key;
  const lastSync = connection.last_sync ? parseISO(connection.last_sync) : null;

  const syncProgress = jobStatus
    ? jobStatus.status === "running"
      ? 50
      : jobStatus.status === "finished"
      ? 100
      : 0
    : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Button
          variant="ghost"
          className="mb-4 -ml-2"
          onClick={() => navigate("/accounts")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {connection.supported_banks?.logo_url ? (
              <img
                src={connection.supported_banks.logo_url}
                alt={bankName}
                className="w-12 h-12 rounded-xl object-contain"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{bankName}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge
                  variant={connection.status === "active" ? "default" : "destructive"}
                >
                  {connection.status === "active" ? "Conectado" : connection.status}
                </Badge>
                <span>•</span>
                <span>{accountCount} conta{accountCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleRefresh}
            disabled={isResyncing || isPolling}
            className="gap-2"
          >
            {isResyncing || isPolling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sincronizar
          </Button>
        </div>

        {/* Sync progress */}
        {(isResyncing || isPolling) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4"
          >
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {jobStatus?.status === "running"
                  ? "Sincronizando transações..."
                  : "Preparando..."}
              </span>
              <span className="text-muted-foreground">{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
          </motion.div>
        )}
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-3 mb-8"
      >
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disponível</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAvailable)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última sync</p>
                <p className="text-lg font-medium">
                  {lastSync
                    ? format(lastSync, "dd/MM 'às' HH:mm", { locale: ptBR })
                    : "Nunca"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Accounts breakdown */}
      {connection.bank_accounts && connection.bank_accounts.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold mb-4">Contas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {connection.bank_accounts.map((account) => (
              <Card key={account.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {account.account_type}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {formatCurrency(account.current_balance || 0, account.currency)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-lg font-semibold mb-4">Transações</h2>
        <TransactionsList
          transactions={transactions}
          isLoading={isLoadingTransactions}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage || false}
          fetchNextPage={fetchNextPage}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onRefresh={() => refetch()}
          isRefreshing={isResyncing}
        />
      </motion.div>
    </div>
  );
}
