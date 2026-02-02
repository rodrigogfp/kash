import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCreateLinkToken, useExchangePublicToken } from "@/hooks/useAddBank";
import type { SupportedBank } from "@/hooks/useSupportedBanks";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Building2 } from "lucide-react";

type FlowStep = "initializing" | "linking" | "exchanging" | "syncing" | "success" | "error";

interface BankLinkFlowProps {
  bank: SupportedBank | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function BankLinkFlow({ bank, open, onOpenChange, onComplete }: BankLinkFlowProps) {
  const [step, setStep] = useState<FlowStep>("initializing");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const createLinkToken = useCreateLinkToken();
  const exchangePublicToken = useExchangePublicToken();

  const resetFlow = useCallback(() => {
    setStep("initializing");
    setProgress(0);
    setErrorMessage(null);
    setLinkToken(null);
  }, []);

  // Start the flow when modal opens with a bank selected
  useEffect(() => {
    if (open && bank) {
      startLinkFlow();
    } else {
      resetFlow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bank]);

  const startLinkFlow = async () => {
    if (!bank) return;

    try {
      setStep("initializing");
      setProgress(10);

      // Step 1: Create link token
      const result = await createLinkToken.mutateAsync(bank.provider_key);
      setLinkToken(result.linkToken);
      setProgress(30);
      setStep("linking");

      // In a real implementation, you would:
      // 1. Load the provider's widget/SDK
      // 2. Initialize it with the link token
      // 3. Handle the callback with the public token
      
      // For mock purposes, we simulate the provider flow
      await simulateProviderFlow(result.linkToken, bank.provider_key);
    } catch (error) {
      setStep("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro desconhecido");
    }
  };

  const simulateProviderFlow = async (token: string, providerKey: string) => {
    // Simulate provider widget interaction
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setProgress(50);
    
    // Simulate user completing authorization
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setProgress(70);
    setStep("exchanging");

    // Exchange the mock public token
    try {
      // In real implementation, this would come from the provider callback
      const mockPublicToken = `public_${token.split("_").pop()}`;
      
      await exchangePublicToken.mutateAsync({
        providerKey,
        publicToken: mockPublicToken,
      });

      setProgress(90);
      setStep("syncing");
      
      // Simulate initial sync
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setProgress(100);
      setStep("success");
      
      // Auto close after success
      setTimeout(() => {
        onComplete();
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      setStep("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro ao conectar");
    }
  };

  const handleRetry = () => {
    resetFlow();
    startLinkFlow();
  };

  const getStepContent = () => {
    switch (step) {
      case "initializing":
        return {
          icon: <Loader2 className="w-12 h-12 text-primary animate-spin" />,
          title: "Preparando conexão...",
          description: "Estamos configurando a conexão segura com seu banco.",
        };
      case "linking":
        return {
          icon: <Building2 className="w-12 h-12 text-primary" />,
          title: "Conectando ao banco",
          description: "Autorize o acesso na janela do seu banco.",
        };
      case "exchanging":
        return {
          icon: <Loader2 className="w-12 h-12 text-primary animate-spin" />,
          title: "Processando autorização...",
          description: "Validando suas credenciais.",
        };
      case "syncing":
        return {
          icon: <Loader2 className="w-12 h-12 text-primary animate-spin" />,
          title: "Sincronizando dados...",
          description: "Buscando suas contas e saldos.",
        };
      case "success":
        return {
          icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
          title: "Conta conectada!",
          description: "Suas contas foram sincronizadas com sucesso.",
        };
      case "error":
        return {
          icon: <XCircle className="w-12 h-12 text-destructive" />,
          title: "Erro na conexão",
          description: errorMessage || "Não foi possível conectar sua conta.",
        };
    }
  };

  const content = getStepContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {bank?.logo_url ? (
              <img src={bank.logo_url} alt={bank.display_name} className="w-6 h-6" />
            ) : (
              <Building2 className="w-6 h-6" />
            )}
            {bank?.display_name}
          </DialogTitle>
          <DialogDescription>
            Conectando sua conta bancária
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-8 space-y-6">
          <motion.div
            key={step}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {content.icon}
          </motion.div>

          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">{content.title}</h3>
            <p className="text-sm text-muted-foreground">{content.description}</p>
          </div>

          {step !== "error" && step !== "success" && (
            <div className="w-full">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center mt-2">
                {progress}% concluído
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
