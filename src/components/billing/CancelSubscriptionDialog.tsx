import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (immediately: boolean) => Promise<void>;
  periodEnd: string | null;
  planName: string;
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  onConfirm,
  periodEnd,
  planName,
}: CancelSubscriptionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async (immediately: boolean) => {
    setIsLoading(true);
    try {
      await onConfirm(immediately);
      onOpenChange(false);
    } catch (error) {
      // Error handled in parent
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4">
            <p>
              Você está prestes a cancelar sua assinatura do plano <strong>{planName}</strong>.
            </p>
            {periodEnd && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  Ao cancelar, você manterá acesso a todos os recursos premium até{" "}
                  <strong>
                    {format(new Date(periodEnd), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </strong>.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Após essa data, sua conta será convertida para o plano Grátis com limites de 
              2 conexões bancárias e 20 mensagens IA por dia.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isLoading}>Manter Assinatura</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleCancel(false);
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cancelar ao Final do Período
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
