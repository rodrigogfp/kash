import { useState } from "react";
import { Building2, RefreshCw, Trash2, AlertCircle, Loader2, Plus, CheckCircle } from "lucide-react";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { AddBankModal } from "@/components/bank/AddBankModal";
import { BankLinkFlow } from "@/components/bank/BankLinkFlow";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SupportedBank } from "@/hooks/useSupportedBanks";

export default function ConnectedBanksPage() {
  const { user } = useAuth();
  const { data: connections, isLoading, refetch } = useBankConnections(user?.id);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [selectedBank, setSelectedBank] = useState<SupportedBank | null>(null);
  const [showLinkFlow, setShowLinkFlow] = useState(false);
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  const handleRevoke = async () => {
    if (!revokeId) return;
    
    setIsRevoking(true);
    try {
      // Call edge function to revoke tokens
      const { error: revokeError } = await supabase.functions.invoke("bank-operations", {
        body: {
          action: "revoke",
          connectionId: revokeId,
        },
      });
      
      if (revokeError) throw revokeError;
      
      toast.success("Conexão revogada com sucesso");
      refetch();
    } catch (error) {
      toast.error("Erro ao revogar conexão");
    } finally {
      setIsRevoking(false);
      setRevokeId(null);
    }
  };

  const handleResync = async (connectionId: string) => {
    setResyncingId(connectionId);
    try {
      const { error } = await supabase.functions.invoke("bank-operations", {
        body: {
          action: "start_manual_resync",
          connection_id: connectionId,
        },
      });
      
      if (error) throw error;
      toast.success("Sincronização iniciada");
      refetch();
    } catch (error) {
      toast.error("Erro ao sincronizar");
    } finally {
      setResyncingId(null);
    }
  };

  const handleSelectBank = (bank: SupportedBank) => {
    setSelectedBank(bank);
    setShowAddBank(false);
    setShowLinkFlow(true);
  };

  const handleBankLinkComplete = () => {
    setSelectedBank(null);
    setShowLinkFlow(false);
    refetch();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Ativa</Badge>;
      case "pending":
        return <Badge variant="outline">Pendente</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "expired":
        return <Badge variant="secondary">Expirada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões bancárias via Open Finance
          </p>
        </div>
        <Button onClick={() => setShowAddBank(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Banco
        </Button>
      </div>

      {connections?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma conta conectada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Conecte seu banco para começar a agregar suas finanças
            </p>
            <Button onClick={() => setShowAddBank(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Conectar Banco
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections?.map((connection) => (
            <Card key={connection.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {connection.provider_key}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Conectado em{" "}
                        {format(new Date(connection.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(connection.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    {connection.last_sync && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-primary" />
                        Última sincronização:{" "}
                        {format(new Date(connection.last_sync), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    )}
                    {connection.error_message && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {connection.error_message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResync(connection.id)}
                      disabled={resyncingId === connection.id}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${resyncingId === connection.id ? "animate-spin" : ""}`} />
                      Sincronizar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRevokeId(connection.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Revogar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar Acesso Bancário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja revogar esta conexão? Isso removerá o acesso aos dados 
              desta conta e você precisará reconectar para visualizar novas transações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revogar Acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Bank Modal */}
      <AddBankModal 
        open={showAddBank} 
        onOpenChange={setShowAddBank} 
        onSelectBank={handleSelectBank}
      />

      {/* Bank Link Flow */}
      <BankLinkFlow
        bank={selectedBank}
        open={showLinkFlow}
        onOpenChange={setShowLinkFlow}
        onComplete={handleBankLinkComplete}
      />
    </div>
  );
}
