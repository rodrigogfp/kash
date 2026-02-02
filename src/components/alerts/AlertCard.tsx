import React from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  AlertTriangle, 
  Bell, 
  TrendingUp, 
  Wallet, 
  Target, 
  CreditCard,
  X,
  ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Alert } from "@/hooks/useAlerts";

interface AlertCardProps {
  alert: Alert;
  onDismiss?: (alertId: string) => void;
  onMarkSeen?: (alertId: string) => void;
  compact?: boolean;
}

function getAlertIcon(alertType: string) {
  switch (alertType) {
    case "anomaly":
    case "large_transaction":
      return <AlertTriangle className="w-5 h-5" />;
    case "bill_due":
      return <CreditCard className="w-5 h-5" />;
    case "low_balance":
      return <Wallet className="w-5 h-5" />;
    case "goal_progress":
      return <Target className="w-5 h-5" />;
    default:
      return <Bell className="w-5 h-5" />;
  }
}

function getSeverityStyles(severity: string) {
  switch (severity) {
    case "critical":
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
        border: "border-destructive/30",
        badge: "destructive" as const,
      };
    case "warning":
      return {
        bg: "bg-warning/10",
        text: "text-warning",
        border: "border-warning/30",
        badge: "outline" as const,
      };
    default:
      return {
        bg: "bg-primary/10",
        text: "text-primary",
        border: "border-primary/30",
        badge: "secondary" as const,
      };
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function AlertCard({ alert, onDismiss, onMarkSeen, compact = false }: AlertCardProps) {
  const styles = getSeverityStyles(alert.severity);
  const payload = alert.payload as Record<string, unknown> | null;
  
  // Mark as seen on first render if unseen
  React.useEffect(() => {
    if (!alert.seen && onMarkSeen) {
      onMarkSeen(alert.id);
    }
  }, [alert.id, alert.seen, onMarkSeen]);

  const timeAgo = formatDistanceToNow(parseISO(alert.created_at), { 
    addSuffix: true,
    locale: ptBR 
  });

  if (compact) {
    return (
      <div 
        className={`p-3 rounded-lg ${styles.bg} ${styles.border} border flex items-start gap-3 ${!alert.seen ? "ring-2 ring-primary/20" : ""}`}
      >
        <div className={`${styles.text} mt-0.5`}>
          {getAlertIcon(alert.alert_type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{alert.title}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        {onDismiss && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 shrink-0"
            onClick={() => onDismiss(alert.id)}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`glass p-4 ${styles.border} border-l-4 ${!alert.seen ? "ring-2 ring-primary/20" : ""}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${styles.bg} flex items-center justify-center shrink-0 ${styles.text}`}>
            {getAlertIcon(alert.alert_type)}
          </div>
          
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium">{alert.title}</h4>
                {alert.message && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {alert.message}
                  </p>
                )}
              </div>
              
              {onDismiss && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 shrink-0"
                  onClick={() => onDismiss(alert.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {/* Extra info from payload */}
            {payload && (
              <div className="flex flex-wrap gap-2 mt-2">
                {payload.amount && (
                  <Badge variant="secondary" className="text-xs">
                    {formatCurrency(payload.amount as number)}
                  </Badge>
                )}
                {payload.merchant_name && (
                  <Badge variant="outline" className="text-xs">
                    {payload.merchant_name as string}
                  </Badge>
                )}
                {payload.goal_name && (
                  <Badge variant="outline" className="text-xs">
                    {payload.goal_name as string}
                  </Badge>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
              
              <div className="flex items-center gap-2">
                <Badge variant={styles.badge} className="text-xs capitalize">
                  {alert.severity === "critical" ? "Crítico" : 
                   alert.severity === "warning" ? "Atenção" : "Info"}
                </Badge>
                
                {alert.action_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={alert.action_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Ver
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
