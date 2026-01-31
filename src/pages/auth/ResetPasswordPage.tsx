import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  resetPasswordSchema,
  newPasswordSchema,
  type ResetPasswordFormData,
  type NewPasswordFormData,
} from "@/lib/validations/auth";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword, updatePassword, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check if we're in the password update flow (user clicked email link)
  const isUpdateFlow = !!searchParams.get("type") || !!user;

  const requestForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const updateForm = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
  });

  useEffect(() => {
    // If user is logged in and not in update flow, redirect
    if (user && !isUpdateFlow) {
      navigate("/", { replace: true });
    }
  }, [user, isUpdateFlow, navigate]);

  const onRequestReset = async (data: ResetPasswordFormData) => {
    setIsLoading(true);

    try {
      const { error } = await resetPassword(data.email);

      if (error) {
        toast.error(error.message);
        return;
      }

      setEmailSent(true);
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const onUpdatePassword = async (data: NewPasswordFormData) => {
    setIsLoading(true);

    try {
      const { error } = await updatePassword(data.password);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Senha atualizada com sucesso!");
      navigate("/", { replace: true });
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  // Email sent confirmation
  if (emailSent) {
    return (
      <AuthLayout
        title="Verifique seu email"
        subtitle="Enviamos um link para redefinir sua senha"
      >
        <div className="flex flex-col items-center space-y-4 py-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <p className="text-center text-muted-foreground">
            Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.
          </p>
          <Link to="/auth/login">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // Update password flow
  if (isUpdateFlow) {
    return (
      <AuthLayout
        title="Nova senha"
        subtitle="Digite sua nova senha"
      >
        <form onSubmit={updateForm.handleSubmit(onUpdatePassword)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                {...updateForm.register("password")}
                className={updateForm.formState.errors.password ? "border-destructive pr-10" : "pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {updateForm.formState.errors.password && (
              <p className="text-sm text-destructive">{updateForm.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                {...updateForm.register("confirmPassword")}
                className={updateForm.formState.errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {updateForm.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{updateForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 font-medium"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              "Atualizar senha"
            )}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  // Request reset flow
  return (
    <AuthLayout
      title="Redefinir senha"
      subtitle="Digite seu email para receber o link de redefinição"
    >
      <form onSubmit={requestForm.handleSubmit(onRequestReset)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            {...requestForm.register("email")}
            className={requestForm.formState.errors.email ? "border-destructive" : ""}
          />
          {requestForm.formState.errors.email && (
            <p className="text-sm text-destructive">{requestForm.formState.errors.email.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-12 font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            "Enviar link"
          )}
        </Button>
      </form>

      <Link to="/auth/login" className="block text-center">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </Button>
      </Link>
    </AuthLayout>
  );
}