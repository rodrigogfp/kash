import { Check, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/hooks/usePlans";

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  isLoading: boolean;
  isSelected: boolean;
  onSelect: (planSlug: string) => void;
}

export function PlanCard({ 
  plan, 
  isCurrentPlan, 
  isLoading, 
  isSelected, 
  onSelect 
}: PlanCardProps) {
  const features = (plan.features as string[]) || [];
  const limits = plan.limits as {
    max_bank_connections: number;
    max_chat_messages_per_day: number;
    reports_enabled: boolean;
    tax_report_enabled: boolean;
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const isPro = plan.slug === "pro";
  const isEnterprise = plan.slug === "enterprise";

  return (
    <Card className={`relative ${isCurrentPlan ? "border-primary ring-1 ring-primary" : ""} ${isPro ? "border-primary/50" : ""}`}>
      {isPro && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground">
            <Sparkles className="h-3 w-3 mr-1" />
            Mais Popular
          </Badge>
        </div>
      )}
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

        {/* Feature Limits Highlight */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span>Conexões bancárias</span>
            <span className="font-medium">
              {limits.max_bank_connections === -1 ? "Ilimitadas" : limits.max_bank_connections}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Mensagens IA/dia</span>
            <span className="font-medium">
              {limits.max_chat_messages_per_day === -1 ? "Ilimitadas" : limits.max_chat_messages_per_day}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Relatórios</span>
            <span className="font-medium">
              {limits.reports_enabled ? "✓" : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Relatório Fiscal</span>
            <span className="font-medium">
              {limits.tax_report_enabled ? "✓" : "—"}
            </span>
          </div>
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
          variant={isCurrentPlan ? "outline" : isPro ? "default" : "secondary"}
          disabled={isCurrentPlan || isLoading || plan.slug === "free"}
          onClick={() => onSelect(plan.slug)}
        >
          {isSelected && isLoading && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          {isCurrentPlan ? "Plano Atual" : plan.slug === "free" ? "Plano Grátis" : "Fazer Upgrade"}
        </Button>
      </CardFooter>
    </Card>
  );
}
