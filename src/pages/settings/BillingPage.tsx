import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Receipt, Loader2 } from "lucide-react";
import { usePlans, useUserPlanLimits, useInvoices } from "@/hooks/usePlans";
import { useSubscription } from "@/hooks/useSubscription";
import { useBilling } from "@/hooks/useBilling";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CurrentPlanCard,
  PlanCard,
  InvoicesList,
  CancelSubscriptionDialog,
} from "@/components/billing";

export default function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: userPlan, isLoading: planLoading } = useUserPlanLimits();
  const { data: subscription, isLoading: subLoading, refetch: refetchSub } = useSubscription();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { isLoading: billingLoading, createCheckoutSession, openBillingPortal, cancelSubscription } = useBilling();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Handle success/cancel URL params
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Assinatura realizada com sucesso!", {
        description: "Seu plano foi atualizado. Aguarde alguns segundos para a confirmação.",
      });
      // Refetch subscription after a delay to allow webhook processing
      setTimeout(() => refetchSub(), 2000);
      setSearchParams({});
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Checkout cancelado");
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetchSub]);

  const handleUpgrade = (planSlug: string) => {
    if (planSlug === "free") {
      toast.info("Você já está no plano gratuito");
      return;
    }
    setSelectedPlan(planSlug);
    createCheckoutSession(planSlug);
  };

  const handleCancelSubscription = async (immediately: boolean) => {
    await cancelSubscription(immediately);
    refetchSub();
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
      <CurrentPlanCard
        userPlan={userPlan}
        subscription={subscription}
        onManageSubscription={openBillingPortal}
        onCancelSubscription={() => setCancelDialogOpen(true)}
        isLoading={billingLoading}
      />

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Planos Disponíveis</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={plan.slug === userPlan?.plan_slug}
              isLoading={billingLoading}
              isSelected={selectedPlan === plan.slug}
              onSelect={handleUpgrade}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Invoices */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Histórico de Faturas
        </h2>
        <InvoicesList invoices={invoices} isLoading={invoicesLoading} />
      </div>

      {/* Cancel Subscription Dialog */}
      <CancelSubscriptionDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelSubscription}
        periodEnd={subscription?.current_period_end ?? null}
        planName={userPlan?.plan_name ?? "Premium"}
      />
    </div>
  );
}
