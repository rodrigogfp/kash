import React from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogOut, Wallet, TrendingUp, MessageCircle, Settings, Plus, RefreshCw, Target, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useUserBalance } from "@/hooks/useUserBalance";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useUrgentAlerts, useDismissAlert, useMarkAlertAsSeen } from "@/hooks/useAlerts";
import { AlertBell } from "@/components/alerts";
import { AlertCard } from "@/components/alerts/AlertCard";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { data: balance, isLoading: isLoadingBalance } = useUserBalance(user?.id);
  const { data: connections, isLoading: isLoadingConnections } = useBankConnections(user?.id);
  const { data: urgentAlerts } = useUrgentAlerts(user?.id, 3);
  const dismissAlert = useDismissAlert();
  const markSeen = useMarkAlertAsSeen();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Até logo!");
    navigate("/auth/login");
  };

  const handleDismissAlert = (alertId: string) => {
    if (user) {
      dismissAlert.mutate({ alertId, userId: user.id });
    }
  };

  const handleMarkSeen = (alertId: string) => {
    if (user) {
      markSeen.mutate({ alertId, userId: user.id });
    }
  };

  const displayName = profile?.preferred_name || profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Usuário";

  const hasConnections = connections && connections.length > 0;
  const lastSync = balance?.last_sync ? parseISO(balance.last_sync) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 glass border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gradient">Kash</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Olá, {displayName}
            </span>
            {user && <AlertBell userId={user.id} />}
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h2 className="text-3xl font-semibold mb-2">Bom dia, {displayName}!</h2>
          <p className="text-muted-foreground">Aqui está um resumo das suas finanças.</p>
        </div>

        {/* Urgent alerts */}
        {urgentAlerts && urgentAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4" />
              <span>Alertas importantes</span>
            </div>
            {urgentAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                compact
                onDismiss={handleDismissAlert}
                onMarkSeen={handleMarkSeen}
              />
            ))}
          </div>
        )}

        {/* Balance card */}
        <Card className="glass-strong mb-8 glow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Saldo total</CardDescription>
              {lastSync && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Atualizado {format(lastSync, "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
            {isLoadingBalance ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <CardTitle className="text-4xl font-bold">
                {formatCurrency(balance?.total_balance || 0)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            {hasConnections ? (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{balance?.account_count || 0} conta{(balance?.account_count || 0) !== 1 ? "s" : ""}</span>
                <span>•</span>
                <span>{connections.length} banco{connections.length !== 1 ? "s" : ""} conectado{connections.length !== 1 ? "s" : ""}</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Conecte suas contas bancárias para ver seu saldo agregado.
                </p>
                <Button className="mt-4 gap-2" onClick={() => navigate("/accounts")}>
                  <Plus className="w-4 h-4" />
                  Adicionar conta
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card 
            className="glass hover:glow transition-shadow cursor-pointer"
            onClick={() => navigate("/accounts")}
          >
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Contas</CardTitle>
                <CardDescription>Gerencie suas contas</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="glass hover:glow transition-shadow cursor-pointer"
            onClick={() => navigate("/analytics")}
          >
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div>
                <CardTitle className="text-lg">Análises</CardTitle>
                <CardDescription>Veja seus gastos</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="glass hover:glow transition-shadow cursor-pointer"
            onClick={() => navigate("/goals")}
          >
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-warning" />
              </div>
              <div>
                <CardTitle className="text-lg">Metas</CardTitle>
                <CardDescription>Acompanhe objetivos</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="glass hover:glow transition-shadow cursor-pointer"
            onClick={() => navigate("/chat")}
          >
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg">Chat IA</CardTitle>
                <CardDescription>Pergunte sobre finanças</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Settings shortcut */}
        <div className="mt-8 flex justify-center">
          <Button 
            variant="ghost" 
            className="gap-2 text-muted-foreground"
            onClick={() => navigate("/settings/notifications")}
          >
            <Settings className="w-4 h-4" />
            Configurações
          </Button>
        </div>
      </main>
    </div>
  );
}