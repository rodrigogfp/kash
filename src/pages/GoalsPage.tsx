import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Target, ArrowLeft, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useGoals, 
  useGoalWithPrediction,
  useCreateGoal, 
  useUpdateGoal, 
  useDeleteGoal,
  useAddContribution,
  type Goal 
} from "@/hooks/useGoals";
import { GoalCard, NewGoalModal, ContributionModal } from "@/components/goals";
import { toast } from "sonner";

type FilterStatus = "all" | "active" | "completed";

export default function GoalsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [isContributionOpen, setIsContributionOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  
  const { data: goals, isLoading } = useGoals(user?.id);
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const addContribution = useAddContribution();

  const filteredGoals = React.useMemo(() => {
    if (!goals) return [];
    if (statusFilter === "all") return goals;
    return goals.filter(g => g.status === statusFilter);
  }, [goals, statusFilter]);

  const handleCreateGoal = (data: Parameters<typeof createGoal.mutate>[0]) => {
    createGoal.mutate(data, {
      onSuccess: () => {
        setIsNewGoalOpen(false);
        setEditGoal(null);
        toast.success("Meta criada com sucesso!");
      },
      onError: (err) => {
        toast.error("Erro ao criar meta");
        console.error(err);
      },
    });
  };

  const handleUpdateGoal = (data: Parameters<typeof createGoal.mutate>[0]) => {
    if (!editGoal) return;
    
    updateGoal.mutate({
      id: editGoal.id,
      userId: user!.id,
      name: data.name,
      target_amount: data.target_amount,
      deadline: data.deadline,
      category: data.category,
    }, {
      onSuccess: () => {
        setIsNewGoalOpen(false);
        setEditGoal(null);
        toast.success("Meta atualizada!");
      },
      onError: (err) => {
        toast.error("Erro ao atualizar meta");
        console.error(err);
      },
    });
  };

  const handleDelete = (goalId: string) => {
    if (!user) return;
    
    deleteGoal.mutate({ id: goalId, userId: user.id }, {
      onSuccess: () => {
        toast.success("Meta excluída");
      },
      onError: (err) => {
        toast.error("Erro ao excluir meta");
        console.error(err);
      },
    });
  };

  const handleDeposit = (goalId: string) => {
    const goal = goals?.find(g => g.id === goalId);
    if (goal) {
      setSelectedGoal(goal);
      setIsContributionOpen(true);
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditGoal(goal);
    setIsNewGoalOpen(true);
  };

  const handleContribute = (data: { amount: number; note?: string }) => {
    if (!selectedGoal || !user) return;
    
    addContribution.mutate({
      goalId: selectedGoal.id,
      userId: user.id,
      amount: data.amount,
      note: data.note,
    }, {
      onSuccess: () => {
        setIsContributionOpen(false);
        setSelectedGoal(null);
        toast.success("Contribuição registrada!");
      },
      onError: (err) => {
        toast.error("Erro ao registrar contribuição");
        console.error(err);
      },
    });
  };

  const filterLabels: Record<FilterStatus, string> = {
    all: "Todas",
    active: "Ativas",
    completed: "Concluídas",
  };

  const stats = React.useMemo(() => {
    if (!goals) return { total: 0, active: 0, completed: 0, totalSaved: 0 };
    return {
      total: goals.length,
      active: goals.filter(g => g.status === "active").length,
      completed: goals.filter(g => g.status === "completed").length,
      totalSaved: goals.reduce((sum, g) => sum + g.current_amount, 0),
    };
  }, [goals]);

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 glass border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Metas</h1>
          </div>
          <Button onClick={() => { setEditGoal(null); setIsNewGoalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Meta
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Total de Metas</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Ativas</p>
            <p className="text-2xl font-bold text-primary">{stats.active}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Concluídas</p>
            <p className="text-2xl font-bold text-success">{stats.completed}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Total Guardado</p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                notation: "compact",
              }).format(stats.totalSaved)}
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">Suas metas</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                {filterLabels[statusFilter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                Todas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                Ativas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("completed")}>
                Concluídas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Goals list */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : filteredGoals.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Target className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhuma meta encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {statusFilter === "all" 
                ? "Crie sua primeira meta para começar a economizar!" 
                : "Nenhuma meta com esse status."}
            </p>
            {statusFilter === "all" && (
              <Button onClick={() => setIsNewGoalOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Criar meta
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGoals.map((goal) => (
              <GoalCardWithPrediction
                key={goal.id}
                goal={goal}
                userId={user?.id}
                onDeposit={handleDeposit}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <NewGoalModal
        open={isNewGoalOpen}
        onOpenChange={(open) => {
          setIsNewGoalOpen(open);
          if (!open) setEditGoal(null);
        }}
        onSubmit={editGoal ? handleUpdateGoal : handleCreateGoal}
        userId={user?.id || ""}
        editGoal={editGoal}
        isLoading={createGoal.isPending || updateGoal.isPending}
      />

      <ContributionModal
        open={isContributionOpen}
        onOpenChange={(open) => {
          setIsContributionOpen(open);
          if (!open) setSelectedGoal(null);
        }}
        onSubmit={handleContribute}
        goal={selectedGoal}
        isLoading={addContribution.isPending}
      />
    </div>
  );
}

// Wrapper component to fetch prediction for each goal
function GoalCardWithPrediction({ 
  goal, 
  userId,
  onDeposit,
  onEdit,
  onDelete,
}: { 
  goal: Goal; 
  userId?: string;
  onDeposit?: (goalId: string) => void;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goalId: string) => void;
}) {
  const { data: prediction } = useGoalWithPrediction(userId, goal.id);
  
  return (
    <GoalCard 
      goal={goal} 
      prediction={prediction?.prediction}
      onDeposit={onDeposit}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}
