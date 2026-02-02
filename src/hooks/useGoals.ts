import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Goal = Tables<"goals">;
export type GoalInsert = TablesInsert<"goals">;
export type GoalContribution = Tables<"goal_contributions">;

interface GoalPrediction {
  goal_id: string;
  goal_name: string;
  target_amount: number;
  current_amount: number;
  remaining_amount: number;
  progress_pct: number;
  deadline: string | null;
  prediction: {
    avg_monthly_contribution: number;
    months_to_complete: number | null;
    predicted_completion_date: string | null;
    confidence: "high" | "medium" | "low" | "none";
    on_track: boolean | null;
  };
}

export function useGoals(userId?: string) {
  return useQuery({
    queryKey: ["goals", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!userId,
  });
}

export function useGoalWithPrediction(userId?: string, goalId?: string) {
  return useQuery({
    queryKey: ["goal-prediction", userId, goalId],
    queryFn: async () => {
      if (!userId || !goalId) return null;
      
      const { data, error } = await supabase
        .rpc("predict_goal_completion", {
          p_user_id: userId,
          p_goal_id: goalId,
        });
      
      if (error) throw error;
      return data as unknown as GoalPrediction;
    },
    enabled: !!userId && !!goalId,
  });
}

export function useGoalContributions(goalId?: string) {
  return useQuery({
    queryKey: ["goal-contributions", goalId],
    queryFn: async () => {
      if (!goalId) return [];
      
      const { data, error } = await supabase
        .from("goal_contributions")
        .select("*")
        .eq("goal_id", goalId)
        .order("contributed_at", { ascending: false });
      
      if (error) throw error;
      return data as GoalContribution[];
    },
    enabled: !!goalId,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (goal: GoalInsert) => {
      const { data, error } = await supabase
        .from("goals")
        .insert(goal)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals", variables.user_id] });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, userId, ...updates }: Partial<Goal> & { id: string; userId: string }) => {
      const { data, error } = await supabase
        .from("goals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["goal-prediction", variables.userId, variables.id] });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals", variables.userId] });
    },
  });
}

export function useAddContribution() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      goalId, 
      userId,
      amount, 
      note 
    }: { 
      goalId: string; 
      userId: string;
      amount: number; 
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from("goal_contributions")
        .insert({
          goal_id: goalId,
          amount,
          note,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update goal progress via RPC
      await supabase.rpc("update_goal_progress", {
        p_user_id: userId,
        p_goal_id: goalId,
      });
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["goal-contributions", variables.goalId] });
      queryClient.invalidateQueries({ queryKey: ["goal-prediction", variables.userId, variables.goalId] });
    },
  });
}
