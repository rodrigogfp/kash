import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const TOTAL_STEPS = 3;

export function useOnboarding() {
  const { user, settings, refreshProfile } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentStep = settings?.onboarding_step ?? 0;
  const isCompleted = settings?.onboarding_completed ?? false;

  const updateStep = useCallback(
    async (step: number) => {
      if (!user) return { error: new Error("User not authenticated") };

      setIsUpdating(true);
      try {
        const { error } = await supabase
          .from("user_profiles")
          .update({ onboarding_step: step })
          .eq("id", user.id);

        if (error) throw error;
        
        await refreshProfile();
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error : new Error(String(error)) };
      } finally {
        setIsUpdating(false);
      }
    },
    [user, refreshProfile]
  );

  const nextStep = useCallback(async () => {
    const next = Math.min(currentStep + 1, TOTAL_STEPS);
    return updateStep(next);
  }, [currentStep, updateStep]);

  const prevStep = useCallback(async () => {
    const prev = Math.max(currentStep - 1, 0);
    return updateStep(prev);
  }, [currentStep, updateStep]);

  const completeOnboarding = useCallback(async () => {
    if (!user) return { error: new Error("User not authenticated") };

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          onboarding_completed: true,
          onboarding_step: TOTAL_STEPS,
        })
        .eq("id", user.id);

      if (error) throw error;
      
      await refreshProfile();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    } finally {
      setIsUpdating(false);
    }
  }, [user, refreshProfile]);

  const skipOnboarding = useCallback(async () => {
    return completeOnboarding();
  }, [completeOnboarding]);

  return {
    currentStep,
    totalSteps: TOTAL_STEPS,
    isCompleted,
    isUpdating,
    nextStep,
    prevStep,
    updateStep,
    completeOnboarding,
    skipOnboarding,
  };
}