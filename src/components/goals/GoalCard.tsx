import React from "react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target, TrendingUp, Calendar, MoreVertical, Trash2, PlusCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Goal } from "@/hooks/useGoals";

interface GoalCardProps {
  goal: Goal;
  prediction?: {
    predicted_completion_date: string | null;
    confidence: "high" | "medium" | "low" | "none";
    on_track: boolean | null;
    avg_monthly_contribution: number;
  } | null;
  onDeposit?: (goalId: string) => void;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goalId: string) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function GoalCard({ goal, prediction, onDeposit, onEdit, onDelete }: GoalCardProps) {
  const progressPercent = goal.target_amount > 0 
    ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) 
    : 0;
  
  const isCompleted = goal.status === "completed";
  const isExpired = goal.status === "expired";
  const daysRemaining = goal.deadline 
    ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`glass hover:glow transition-all ${isCompleted ? "border-success/30" : isExpired ? "border-destructive/30" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isCompleted 
                  ? "bg-success/10" 
                  : isExpired 
                    ? "bg-destructive/10" 
                    : "bg-primary/10"
              }`}>
                <Target className={`w-5 h-5 ${
                  isCompleted 
                    ? "text-success" 
                    : isExpired 
                      ? "text-destructive" 
                      : "text-primary"
                }`} />
              </div>
              <div>
                <CardTitle className="text-base">{goal.name}</CardTitle>
                {goal.category && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {goal.category}
                  </Badge>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isCompleted && (
                  <DropdownMenuItem onClick={() => onDeposit?.(goal.id)}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Depositar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onEdit?.(goal)}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete?.(goal.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Progress section */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">
                {formatCurrency(goal.current_amount)}
              </span>
              <span className="text-sm text-muted-foreground">
                de {formatCurrency(goal.target_amount)}
              </span>
            </div>
            
            <Progress 
              value={progressPercent} 
              className={`h-2 ${isCompleted ? "[&>div]:bg-success" : ""}`}
            />
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progressPercent.toFixed(0)}% concluído</span>
              {daysRemaining !== null && !isCompleted && (
                <span className={daysRemaining < 0 ? "text-destructive" : daysRemaining <= 7 ? "text-warning" : ""}>
                  {daysRemaining < 0 
                    ? `Expirado há ${Math.abs(daysRemaining)} dias` 
                    : `${daysRemaining} dias restantes`}
                </span>
              )}
            </div>
          </div>
          
          {/* Prediction section */}
          {prediction && !isCompleted && prediction.predicted_completion_date && (
            <div className="pt-2 border-t border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Previsão de conclusão:</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-medium">
                    {format(parseISO(prediction.predicted_completion_date), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                </div>
                
                {prediction.on_track !== null && (
                  <Badge variant={prediction.on_track ? "default" : "destructive"} className="text-xs">
                    {prediction.on_track ? "No prazo" : "Atrasado"}
                  </Badge>
                )}
              </div>
              
              {prediction.avg_monthly_contribution > 0 && (
                <p className="text-xs text-muted-foreground">
                  Contribuição média: {formatCurrency(prediction.avg_monthly_contribution)}/mês
                </p>
              )}
              
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Confiança:</span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    prediction.confidence === "high" 
                      ? "border-success text-success" 
                      : prediction.confidence === "medium" 
                        ? "border-warning text-warning" 
                        : "border-muted-foreground"
                  }`}
                >
                  {prediction.confidence === "high" ? "Alta" : 
                   prediction.confidence === "medium" ? "Média" : 
                   prediction.confidence === "low" ? "Baixa" : "N/A"}
                </Badge>
              </div>
            </div>
          )}
          
          {/* Completed badge */}
          {isCompleted && (
            <div className="pt-2 border-t border-border/50">
              <Badge variant="default" className="bg-success text-success-foreground">
                🎉 Meta concluída!
              </Badge>
            </div>
          )}
          
          {/* Quick deposit button for active goals */}
          {!isCompleted && !isExpired && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2"
              onClick={() => onDeposit?.(goal.id)}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar contribuição
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
