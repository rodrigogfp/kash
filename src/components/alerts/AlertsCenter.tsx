import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Filter, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertCard } from "./AlertCard";
import { 
  useAlerts, 
  useMarkAlertAsSeen, 
  useDismissAlert, 
  useMarkAllAlertsSeen,
  useDismissAllAlerts,
  type Alert,
  type AlertSeverity 
} from "@/hooks/useAlerts";

interface AlertsCenterProps {
  userId: string;
}

type FilterType = "all" | "unread" | AlertSeverity;

export function AlertsCenter({ userId }: AlertsCenterProps) {
  const [filter, setFilter] = React.useState<FilterType>("all");
  
  const { data: alerts, isLoading } = useAlerts(userId, {
    unreadOnly: filter === "unread",
    severity: ["info", "warning", "critical"].includes(filter) ? filter as AlertSeverity : undefined,
  });
  
  const markSeen = useMarkAlertAsSeen();
  const dismiss = useDismissAlert();
  const markAllSeen = useMarkAllAlertsSeen();
  const dismissAll = useDismissAllAlerts();

  const handleMarkSeen = (alertId: string) => {
    markSeen.mutate({ alertId, userId });
  };

  const handleDismiss = (alertId: string) => {
    dismiss.mutate({ alertId, userId });
  };

  const handleMarkAllSeen = () => {
    markAllSeen.mutate(userId);
  };

  const handleDismissAll = () => {
    dismissAll.mutate(userId);
  };

  const unreadCount = alerts?.filter(a => !a.seen).length || 0;
  const filteredAlerts = React.useMemo(() => {
    if (!alerts) return [];
    if (filter === "all") return alerts;
    if (filter === "unread") return alerts.filter(a => !a.seen);
    return alerts.filter(a => a.severity === filter);
  }, [alerts, filter]);

  const filterLabels: Record<FilterType, string> = {
    all: "Todos",
    unread: "Não lidos",
    critical: "Críticos",
    warning: "Atenção",
    info: "Info",
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Alertas</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {unreadCount} não lido{unreadCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                {filterLabels[filter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter("all")}>
                Todos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("unread")}>
                Não lidos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("critical")}>
                Críticos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("warning")}>
                Atenção
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("info")}>
                Info
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={handleMarkAllSeen}
            >
              <CheckCheck className="w-4 h-4" />
              Marcar lidos
            </Button>
          )}

          {alerts && alerts.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDismissAll}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Alerts list */}
      {filteredAlerts.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-1">Nenhum alerta</h3>
          <p className="text-sm text-muted-foreground">
            {filter === "all" 
              ? "Você está em dia! Nenhum alerta no momento." 
              : "Nenhum alerta encontrado com esse filtro."}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={handleDismiss}
                onMarkSeen={handleMarkSeen}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
