import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type NotificationSettings = Tables<"notification_settings">;

export interface AlertPreferences {
  anomaly: { push: boolean; email: boolean };
  bill_due: { push: boolean; email: boolean };
  low_balance: { push: boolean; email: boolean };
  goal_progress: { push: boolean; email: boolean };
  large_transaction: { push: boolean; email: boolean };
  anomaly_threshold?: number;
  low_balance_threshold?: number;
}

export function useNotificationSettings(userId?: string) {
  return useQuery({
    queryKey: ["notification-settings", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (error) throw error;
      return data as NotificationSettings | null;
    },
    enabled: !!userId,
  });
}

export function useCreateOrUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      userId,
      settings 
    }: { 
      userId: string;
      settings: Partial<TablesUpdate<"notification_settings">>;
    }) => {
      // First check if settings exist
      const { data: existing } = await supabase
        .from("notification_settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (existing) {
        // Update
        const { data, error } = await supabase
          .from("notification_settings")
          .update(settings)
          .eq("user_id", userId)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert with defaults
        const { data, error } = await supabase
          .from("notification_settings")
          .insert({
            user_id: userId,
            ...settings,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings", variables.userId] });
    },
  });
}

export function useUpdateAlertPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      userId,
      preferences 
    }: { 
      userId: string;
      preferences: AlertPreferences;
    }) => {
      // First check if settings exist
      const { data: existing } = await supabase
        .from("notification_settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      
      const jsonPrefs = JSON.parse(JSON.stringify(preferences));
      
      if (existing) {
        const { data, error } = await supabase
          .from("notification_settings")
          .update({ alert_preferences: jsonPrefs })
          .eq("user_id", userId)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("notification_settings")
          .insert([{
            user_id: userId,
            alert_preferences: jsonPrefs,
          }])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings", variables.userId] });
    },
  });
}
