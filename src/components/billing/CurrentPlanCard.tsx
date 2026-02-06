import { Crown, CreditCard, Loader2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { UserPlanInfo } from "@/hooks/usePlans";
import type { SubscriptionInfo } from "@/hooks/useSubscription";

interface CurrentPlanCardProps {
  userPlan: UserPlanInfo | null | undefined;
  subscription: SubscriptionInfo | null | undefined;
  onManageSubscription: () => void;
  onCancelSubscription: () => void;
  isLoading: boolean;
}

export function CurrentPlanCard({
  userPlan,
  subscription,
  onManageSubscription,
  onCancelSubscription,
  isLoading,
}: CurrentPlanCardProps) {
  return (
    <Card className="border-primary/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle>Seu Plano Atual</CardTitle>
          </div>
          <Badge variant={userPlan?.is_premium ? "default" : "secondary"}>
            {userPlan?.plan_name || "Grátis"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium capitalize">{subscription?.status || "Ativo"}</p>
          </div>
          {userPlan?.period_end && (
            <div>
              <p className="text-sm text-muted-foreground">Próxima Renovação</p>
              <p className="font-medium">
                {format(new Date(userPlan.period_end), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          )}
          {userPlan?.limits && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Conexões Bancárias</p>
                <p className="font-medium">
                  {userPlan.limits.max_bank_connections === -1 
                    ? "Ilimitadas" 
                    : `Até ${userPlan.limits.max_bank_connections}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mensagens IA/dia</p>
                <p className="font-medium">
                  {userPlan.limits.max_chat_messages_per_day === -1 
                    ? "Ilimitadas" 
                    : `Até ${userPlan.limits.max_chat_messages_per_day}`}
                </p>
              </div>
            </>
          )}
        </div>
        {subscription?.cancel_at_period_end && (
          <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning">
              Sua assinatura será cancelada em{" "}
              {format(new Date(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })}. 
              Você manterá acesso até essa data.
            </p>
          </div>
        )}
      </CardContent>
      {userPlan?.is_premium && (
        <CardFooter className="gap-2">
          <Button variant="outline" onClick={onManageSubscription} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            Gerenciar Pagamento
          </Button>
          {!subscription?.cancel_at_period_end && (
            <Button 
              variant="ghost" 
              onClick={onCancelSubscription} 
              disabled={isLoading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Cancelar Assinatura
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
