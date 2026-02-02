import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useInitiateSync, useRevokeConnection } from "@/hooks/useAddBank";
import type { BankConnectionWithAccounts } from "@/hooks/useBankConnections";
import {
  Building2,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet,
  Loader2,
  ChevronRight,
} from "lucide-react";

interface ConnectionStatusProps {
  connection: BankConnectionWithAccounts;
}

export function ConnectionStatus({ connection }: ConnectionStatusProps) {
  const navigate = useNavigate();
  const [isRevoking, setIsRevoking] = useState(false);
  const initiateSync = useInitiateSync();
  const revokeConnection = useRevokeConnection();

  const handleViewDetails = () => {
    if (connection.id) {
      navigate(`/accounts/${connection.id}`);
    }
  };

  const getStatusBadge = () => {
    switch (connection.status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Ativo
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case "revoked":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Revogado
          </Badge>
        );
      default:
        return <Badge variant="outline">{connection.status}</Badge>;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "R$ --";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalBalance = connection.bank_accounts?.reduce(
    (sum, acc) => sum + (acc.current_balance || 0),
    0
  ) || 0;

  const handleSync = () => {
    if (connection.id) {
      initiateSync.mutate({ connectionId: connection.id });
    }
  };

  const handleRevoke = async () => {
    if (connection.id) {
      setIsRevoking(true);
      try {
        await revokeConnection.mutateAsync(connection.id);
      } finally {
        setIsRevoking(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card 
        className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
        onClick={handleViewDetails}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                {connection.supported_banks?.logo_url ? (
                  <img
                    src={connection.supported_banks.logo_url}
                    alt={connection.supported_banks.display_name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {connection.supported_banks?.display_name || connection.provider_key}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {connection.bank_accounts?.length || 0} conta(s)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Total Balance */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Saldo total</span>
            </div>
            <span className="font-semibold text-lg">
              {formatCurrency(totalBalance)}
            </span>
          </div>

          {/* Accounts List */}
          {connection.bank_accounts && connection.bank_accounts.length > 0 && (
            <div className="space-y-2">
              {connection.bank_accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{account.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {account.account_type}
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(account.current_balance)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error Message */}
          {connection.error_message && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {connection.error_message}
            </div>
          )}

          {/* Last Sync & Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {connection.last_sync ? (
                <>
                  Última sync:{" "}
                  {formatDistanceToNow(new Date(connection.last_sync), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </>
              ) : (
                "Nunca sincronizado"
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={initiateSync.isPending || connection.status !== "active"}
              >
                {initiateSync.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">Sincronizar</span>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={isRevoking}
                  >
                    {isRevoking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revogar conexão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja desconectar{" "}
                      <strong>{connection.supported_banks?.display_name}</strong>?
                      Esta ação não pode ser desfeita e os dados serão removidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRevoke}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sim, revogar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
