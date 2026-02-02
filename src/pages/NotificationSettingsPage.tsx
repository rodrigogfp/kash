import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Bell, 
  Mail, 
  Smartphone, 
  Clock, 
  AlertTriangle,
  CreditCard,
  Wallet,
  Target,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useNotificationSettings, 
  useCreateOrUpdateNotificationSettings,
  type AlertPreferences,
} from "@/hooks/useNotificationSettings";
import { toast } from "sonner";

const ALERT_TYPES = [
  { 
    key: "anomaly", 
    label: "Transações incomuns", 
    description: "Alerta quando detectamos gastos fora do padrão",
    icon: AlertTriangle 
  },
  { 
    key: "bill_due", 
    label: "Contas a pagar", 
    description: "Lembrete de pagamentos recorrentes próximos do vencimento",
    icon: CreditCard 
  },
  { 
    key: "low_balance", 
    label: "Saldo baixo", 
    description: "Aviso quando o saldo ficar abaixo do limite definido",
    icon: Wallet 
  },
  { 
    key: "goal_progress", 
    label: "Progresso de metas", 
    description: "Celebração quando você atinge marcos das suas metas",
    icon: Target 
  },
  { 
    key: "large_transaction", 
    label: "Transações grandes", 
    description: "Alerta para transações acima de um valor",
    icon: TrendingUp 
  },
] as const;

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: `${i.toString().padStart(2, "0")}:00:00`,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

export default function NotificationSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings, isLoading } = useNotificationSettings(user?.id);
  const updateSettings = useCreateOrUpdateNotificationSettings();

  const handleToggle = (field: string, value: boolean) => {
    if (!user) return;
    
    updateSettings.mutate({
      userId: user.id,
      settings: { [field]: value },
    }, {
      onSuccess: () => {
        toast.success("Configuração salva");
      },
      onError: () => {
        toast.error("Erro ao salvar configuração");
      },
    });
  };

  const handleAlertPreferenceChange = (
    alertType: string, 
    channel: "push" | "email", 
    enabled: boolean
  ) => {
    if (!user || !settings) return;

    const currentPrefs = settings.alert_preferences as Record<string, unknown> || {};
    const currentAlertPrefs = (currentPrefs[alertType] || { push: true, email: false }) as { push: boolean; email: boolean };
    
    const updatedPrefs = {
      ...currentPrefs,
      [alertType]: {
        ...currentAlertPrefs,
        [channel]: enabled,
      },
    };

    updateSettings.mutate({
      userId: user.id,
      settings: { alert_preferences: JSON.parse(JSON.stringify(updatedPrefs)) },
    }, {
      onSuccess: () => {
        toast.success("Preferência salva");
      },
      onError: () => {
        toast.error("Erro ao salvar preferência");
      },
    });
  };

  const handleTimeChange = (field: string, value: string) => {
    if (!user) return;
    
    updateSettings.mutate({
      userId: user.id,
      settings: { [field]: value },
    }, {
      onSuccess: () => {
        toast.success("Horário salvo");
      },
      onError: () => {
        toast.error("Erro ao salvar");
      },
    });
  };

  const alertPrefs = (settings?.alert_preferences || {}) as Record<string, { push?: boolean; email?: boolean }>;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="glass border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-3">
            <Skeleton className="w-10 h-10" />
            <Skeleton className="w-48 h-6" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 glass border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Notificações</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Global settings */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Canais de Notificação</CardTitle>
            <CardDescription>
              Escolha como deseja receber alertas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="push">Notificações push</Label>
                  <p className="text-sm text-muted-foreground">No app e navegador</p>
                </div>
              </div>
              <Switch
                id="push"
                checked={settings?.push_enabled ?? true}
                onCheckedChange={(checked) => handleToggle("push_enabled", checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="email">Notificações por email</Label>
                  <p className="text-sm text-muted-foreground">Resumos e alertas importantes</p>
                </div>
              </div>
              <Switch
                id="email"
                checked={settings?.email_enabled ?? true}
                onCheckedChange={(checked) => handleToggle("email_enabled", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Alert types */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Tipos de Alerta</CardTitle>
            <CardDescription>
              Personalize quais alertas você quer receber
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ALERT_TYPES.map((alertType, index) => {
              const IconComponent = alertType.icon;
              const prefs = alertPrefs[alertType.key] || { push: true, email: true };
              
              return (
                <React.Fragment key={alertType.key}>
                  {index > 0 && <Separator />}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <IconComponent className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{alertType.label}</p>
                        <p className="text-sm text-muted-foreground">{alertType.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6 ml-13 pl-13">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`${alertType.key}-push`}
                          checked={prefs.push ?? true}
                          onCheckedChange={(checked) => 
                            handleAlertPreferenceChange(alertType.key, "push", checked)
                          }
                        />
                        <Label htmlFor={`${alertType.key}-push`} className="text-sm">
                          Push
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`${alertType.key}-email`}
                          checked={prefs.email ?? false}
                          onCheckedChange={(checked) => 
                            handleAlertPreferenceChange(alertType.key, "email", checked)
                          }
                        />
                        <Label htmlFor={`${alertType.key}-email`} className="text-sm">
                          Email
                        </Label>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </CardContent>
        </Card>

        {/* Summary settings */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Resumos</CardTitle>
            <CardDescription>
              Resumos periódicos das suas finanças
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="daily">Resumo diário</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba um resumo do dia anterior
                  </p>
                </div>
              </div>
              <Switch
                id="daily"
                checked={settings?.daily_summary_enabled ?? false}
                onCheckedChange={(checked) => handleToggle("daily_summary_enabled", checked)}
              />
            </div>

            {settings?.daily_summary_enabled && (
              <div className="ml-13 pl-13">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Horário do resumo
                </Label>
                <Select
                  value={settings?.daily_summary_time || "09:00:00"}
                  onValueChange={(value) => handleTimeChange("daily_summary_time", value)}
                >
                  <SelectTrigger className="w-32 input-glass">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="weekly">Relatório semanal</Label>
                  <p className="text-sm text-muted-foreground">
                    Análise completa toda segunda-feira
                  </p>
                </div>
              </div>
              <Switch
                id="weekly"
                checked={settings?.weekly_report_enabled ?? true}
                onCheckedChange={(checked) => handleToggle("weekly_report_enabled", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Quiet hours */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Horário silencioso</CardTitle>
            <CardDescription>
              Defina horários para não receber notificações push
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Início
                </Label>
                <Select
                  value={settings?.quiet_hours_start || ""}
                  onValueChange={(value) => handleTimeChange("quiet_hours_start", value)}
                >
                  <SelectTrigger className="w-32 input-glass">
                    <SelectValue placeholder="--:--" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Desligado</SelectItem>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Fim
                </Label>
                <Select
                  value={settings?.quiet_hours_end || ""}
                  onValueChange={(value) => handleTimeChange("quiet_hours_end", value)}
                >
                  <SelectTrigger className="w-32 input-glass">
                    <SelectValue placeholder="--:--" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Desligado</SelectItem>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Durante esse período, você não receberá notificações push (apenas email se habilitado).
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
