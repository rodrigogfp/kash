 import { useState, useEffect } from "react";
 import { useSearchParams } from "react-router-dom";
import { CreditCard, Check, Crown, Loader2, ExternalLink, Receipt } from "lucide-react";
import { usePlans, useUserPlanLimits, useInvoices } from "@/hooks/usePlans";
import { useSubscription } from "@/hooks/useSubscription";
 import { useBilling } from "@/hooks/useBilling";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function BillingPage() {
   const [searchParams, setSearchParams] = useSearchParams();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: userPlan, isLoading: planLoading } = useUserPlanLimits();
   const { data: subscription, isLoading: subLoading, refetch: refetchSub } = useSubscription();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
   const { isLoading: billingLoading, createCheckoutSession, openBillingPortal, cancelSubscription } = useBilling();
   const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
 
   // Handle success/cancel URL params
   useEffect(() => {
     if (searchParams.get('success') === 'true') {
       toast.success("Assinatura realizada com sucesso!", {
         description: "Seu plano foi atualizado."
       });
       refetchSub();
       setSearchParams({});
     } else if (searchParams.get('canceled') === 'true') {
       toast.info("Checkout cancelado");
       setSearchParams({});
     }
   }, [searchParams, setSearchParams, refetchSub]);

   const handleUpgrade = (planSlug: string) => {
     if (planSlug === 'free') {
       toast.info("Você já está no plano gratuito");
       return;
    }
     setSelectedPlan(planSlug);
     createCheckoutSession(planSlug);
  };

   const handleManageSubscription = () => {
     openBillingPortal();
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const isLoading = plansLoading || planLoading || subLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assinatura</h1>
        <p className="text-muted-foreground">
          Gerencie seu plano e histórico de pagamentos
        </p>
      </div>

      {/* Current Plan */}
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
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          {subscription?.cancel_at_period_end && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm text-warning">
                Sua assinatura será cancelada ao final do período atual
              </p>
            </div>
          )}
        </CardContent>
        {userPlan?.is_premium && (
          <CardFooter>
             <Button variant="outline" onClick={handleManageSubscription} disabled={billingLoading}>
               {billingLoading ? (
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
               ) : (
                 <CreditCard className="h-4 w-4 mr-2" />
               )}
               Gerenciar Assinatura
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Planos Disponíveis</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((plan) => {
            const isCurrentPlan = plan.slug === userPlan?.plan_slug;
            const features = (plan.features as string[]) || [];
            
            return (
              <Card
                key={plan.id}
                className={isCurrentPlan ? "border-primary ring-1 ring-primary" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                    {isCurrentPlan && <Badge>Atual</Badge>}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold">
                      {plan.price_cents === 0 ? "Grátis" : formatPrice(plan.price_cents)}
                    </span>
                    {plan.price_cents > 0 && (
                      <span className="text-muted-foreground">/mês</span>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : "default"}
                     disabled={isCurrentPlan || billingLoading || plan.slug === 'free'}
                    onClick={() => handleUpgrade(plan.slug)}
                  >
                     {selectedPlan === plan.slug && billingLoading && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {isCurrentPlan ? "Plano Atual" : "Selecionar"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Invoices */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Histórico de Faturas
        </h2>
        {invoicesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : invoices?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {invoices?.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">{invoice.description || "Assinatura Kash"}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(invoice.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={invoice.status === "paid" ? "default" : "outline"}
                    >
                      {invoice.status === "paid" ? "Pago" : invoice.status}
                    </Badge>
                    <span className="font-medium">
                      {formatPrice(invoice.amount_cents)}
                    </span>
                    {invoice.pdf_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
