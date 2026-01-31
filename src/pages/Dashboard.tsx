import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Wallet, TrendingUp, MessageCircle, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Até logo!");
    navigate("/auth/login");
  };

  const displayName = profile?.preferred_name || profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Usuário";

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
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Olá, {displayName}
            </span>
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

        {/* Balance card */}
        <Card className="glass-strong mb-8 glow">
          <CardHeader>
            <CardDescription>Saldo total</CardDescription>
            <CardTitle className="text-4xl font-bold">R$ 0,00</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Conecte suas contas bancárias para ver seu saldo agregado.
            </p>
            <Button className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Adicionar conta
            </Button>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass hover:glow transition-shadow cursor-pointer">
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

          <Card className="glass hover:glow transition-shadow cursor-pointer">
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

          <Card className="glass hover:glow transition-shadow cursor-pointer">
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
          <Button variant="ghost" className="gap-2 text-muted-foreground">
            <Settings className="w-4 h-4" />
            Configurações
          </Button>
        </div>
      </main>
    </div>
  );
}