import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type Subscription = Tables<"subscriptions">;
export type SubscriptionPlan = "free" | "pro" | "enterprise";

interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: string;
  is_premium: boolean;
  current_period_end: string;
  cancel_at_period_end: boolean;
  features: {
    unlimited_banks: boolean;
    unlimited_chat: boolean;
    annual_tax_reports: boolean;
    priority_support: boolean;
  };
}

export function useSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async (): Promise<SubscriptionInfo> => {
      if (!user) {
        return getDefaultSubscription();
      }

      // Use the RPC function to get subscription info
      const { data, error } = await supabase.rpc("get_user_subscription", {
        p_user_id: user.id,
      });

      if (error) {
        console.error("[useSubscription] Error:", error);
        return getDefaultSubscription();
      }

      // The RPC returns a JSON object
      const subData = data as {
        plan: string;
        status: string;
        current_period_end: string;
        cancel_at_period_end: boolean;
      } | null;

      if (!subData) {
        return getDefaultSubscription();
      }

      const plan = subData.plan as SubscriptionPlan;
      const isPremium = plan === "pro" || plan === "enterprise";

      return {
        plan,
        status: subData.status,
        is_premium: isPremium,
        current_period_end: subData.current_period_end,
        cancel_at_period_end: subData.cancel_at_period_end,
        features: {
          unlimited_banks: isPremium,
          unlimited_chat: isPremium,
          annual_tax_reports: isPremium,
          priority_support: plan === "enterprise",
        },
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function getDefaultSubscription(): SubscriptionInfo {
  return {
    plan: "free",
    status: "active",
    is_premium: false,
    current_period_end: new Date().toISOString(),
    cancel_at_period_end: false,
    features: {
      unlimited_banks: false,
      unlimited_chat: false,
      annual_tax_reports: false,
      priority_support: false,
    },
  };
}

export function useIsPremium() {
  const { data: subscription } = useSubscription();
  return subscription?.is_premium ?? false;
}
