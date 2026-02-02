import React from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCard } from "./AlertCard";
import { 
  useAlerts, 
  useUnreadAlertsCount, 
  useMarkAlertAsSeen,
  useDismissAlert 
} from "@/hooks/useAlerts";

interface AlertBellProps {
  userId: string;
}

export function AlertBell({ userId }: AlertBellProps) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  
  const { data: unreadCount, isLoading: isLoadingCount } = useUnreadAlertsCount(userId);
  const { data: alerts, isLoading: isLoadingAlerts } = useAlerts(userId, { unreadOnly: false });
  const markSeen = useMarkAlertAsSeen();
  const dismiss = useDismissAlert();

  // Get recent alerts (max 5)
  const recentAlerts = React.useMemo(() => {
    if (!alerts) return [];
    return alerts.slice(0, 5);
  }, [alerts]);

  const handleMarkSeen = (alertId: string) => {
    markSeen.mutate({ alertId, userId });
  };

  const handleDismiss = (alertId: string) => {
    dismiss.mutate({ alertId, userId });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <AnimatePresence>
            {!isLoadingCount && unreadCount && unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center px-1"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80 p-0 glass-strong">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Alertas</h3>
            {unreadCount && unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {unreadCount} não lido{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {isLoadingAlerts ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentAlerts.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum alerta
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {recentAlerts.map((alert) => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert} 
                  compact 
                  onDismiss={handleDismiss}
                  onMarkSeen={handleMarkSeen}
                />
              ))}
            </div>
          )}
        </div>
        
        <div className="p-3 border-t border-border">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate("/alerts");
            }}
          >
            Ver todos os alertas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
