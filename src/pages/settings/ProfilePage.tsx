import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Camera, Loader2 } from "lucide-react";
import { useUserProfile, useUpdateUserProfile, useUploadAvatar } from "@/hooks/useUserProfile";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const profileSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  preferred_name: z.string().max(50).optional(),
});

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
];

const LOCALES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
];

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { data: settings, isLoading: settingsLoading } = useUserSettings();
  const updateProfile = useUpdateUserProfile();
  const updateSettings = useUpdateUserSettings();
  const uploadAvatar = useUploadAvatar();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name || "",
      preferred_name: profile?.preferred_name || "",
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      await uploadAvatar.mutateAsync(file);
      toast.success("Avatar atualizado com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar avatar");
      setAvatarPreview(null);
    }
  };

  const onSubmit = async (data: z.infer<typeof profileSchema>) => {
    try {
      await updateProfile.mutateAsync(data);
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar perfil");
    }
  };

  const handleTimezoneChange = async (value: string) => {
    try {
      await updateSettings.mutateAsync({ timezone: value });
      toast.success("Fuso horário atualizado!");
    } catch (error) {
      toast.error("Erro ao atualizar fuso horário");
    }
  };

  const handleLocaleChange = async (value: string) => {
    try {
      await updateSettings.mutateAsync({ locale: value });
      toast.success("Idioma atualizado!");
    } catch (error) {
      toast.error("Erro ao atualizar idioma");
    }
  };

  if (profileLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e preferências
        </p>
      </div>

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Foto de Perfil
          </CardTitle>
          <CardDescription>
            Clique na imagem para alterar seu avatar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview || profile?.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
              >
                {uploadAvatar.isPending ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadAvatar.isPending}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Formatos aceitos: JPEG, PNG, WebP, AVIF</p>
              <p>Tamanho máximo: 5MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Seu nome completo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferred_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Preferido (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Como você gostaria de ser chamado" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Label>Email</Label>
                <Input value={profile?.email || ""} disabled className="mt-1.5 bg-muted" />
                <p className="text-xs text-muted-foreground mt-1">
                  O email não pode ser alterado
                </p>
              </div>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fuso Horário</Label>
              <Select
                value={settings?.timezone || "America/Sao_Paulo"}
                onValueChange={handleTimezoneChange}
                disabled={updateSettings.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select
                value={settings?.locale || "pt-BR"}
                onValueChange={handleLocaleChange}
                disabled={updateSettings.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((locale) => (
                    <SelectItem key={locale.value} value={locale.value}>
                      {locale.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
