import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Key, Fingerprint, History, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useChangePassword, useSecurityOverview, useBankAccessHistory } from "@/hooks/useChangePassword";
import { useUserSettings, useUpdateBiometricSettings } from "@/hooks/useUserSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres")
      .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula")
      .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula")
      .regex(/[0-9]/, "A senha deve conter pelo menos um número")
      .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos um caractere especial"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export default function SecurityPage() {
  const { data: settings, isLoading: settingsLoading } = useUserSettings();
  const changePassword = useChangePassword();
  const updateBiometric = useUpdateBiometricSettings();
  const securityOverview = useSecurityOverview();
  const bankAccessHistory = useBankAccessHistory();
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [securityData, setSecurityData] = useState<any>(null);
  const [accessHistory, setAccessHistory] = useState<any[]>([]);

  const form = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    securityOverview.mutate(undefined, {
      onSuccess: (data) => setSecurityData(data),
    });
    bankAccessHistory.mutate(10, {
      onSuccess: (data) => setAccessHistory(data || []),
    });
  }, []);

  const onPasswordSubmit = async (data: z.infer<typeof passwordSchema>) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Senha alterada com sucesso!");
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar senha");
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    try {
      await updateBiometric.mutateAsync({
        enabled,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      });
      toast.success(enabled ? "Biometria ativada!" : "Biometria desativada");
    } catch (error) {
      toast.error("Erro ao atualizar configuração de biometria");
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Segurança</h1>
        <p className="text-muted-foreground">
          Gerencie sua senha, autenticação e atividades de acesso
        </p>
      </div>

      {/* Security Overview */}
      {securityData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Visão Geral de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Métodos de Login</p>
                <div className="flex flex-wrap gap-1">
                  {securityData.auth_methods?.map((method: string) => (
                    <Badge key={method} variant="secondary">
                      {method}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Contas Bancárias</p>
                <p className="text-lg font-semibold">{securityData.active_connections || 0} conectadas</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Biometria</p>
                <Badge variant={securityData.biometric_enabled ? "default" : "outline"}>
                  {securityData.biometric_enabled ? "Ativada" : "Desativada"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Última Alteração de Senha</p>
                <p className="text-sm">
                  {securityData.last_password_change
                    ? format(new Date(securityData.last_password_change), "dd/MM/yyyy", { locale: ptBR })
                    : "Nunca alterada"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Recomendamos uma senha forte com letras, números e caracteres especiais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha Atual</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Digite sua senha atual"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Digite sua nova senha"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Confirme sua nova senha"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar Senha
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Biometric Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Login Biométrico
          </CardTitle>
          <CardDescription>
            Use Face ID ou Touch ID para fazer login mais rapidamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar Biometria</Label>
              <p className="text-sm text-muted-foreground">
                Disponível apenas em dispositivos compatíveis
              </p>
            </div>
            <Switch
              checked={settings?.biometric_enabled || false}
              onCheckedChange={handleBiometricToggle}
              disabled={updateBiometric.isPending}
            />
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              A autenticação biométrica na web é limitada. Para uma experiência completa, 
              utilize nosso aplicativo móvel quando disponível.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Access History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Atividade Recente de Bancos
          </CardTitle>
          <CardDescription>
            Histórico de acessos e alterações nas conexões bancárias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accessHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma atividade registrada
            </p>
          ) : (
            <div className="space-y-3">
              {accessHistory.map((event, index) => (
                <div key={event.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {event.action === "grant" && "Conexão autorizada"}
                        {event.action === "revoke" && "Conexão revogada"}
                        {event.action === "sync" && "Sincronização realizada"}
                        {event.action === "refresh" && "Token renovado"}
                        {event.action === "error" && "Erro de conexão"}
                      </p>
                      {event.bank_name && (
                        <p className="text-xs text-muted-foreground">{event.bank_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          event.action === "error"
                            ? "destructive"
                            : event.action === "revoke"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {event.action}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
