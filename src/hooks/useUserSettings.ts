import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type UserSettings = Tables<"user_profiles">;

export function useUserSettings() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as UserSettings | null;
    },
    enabled: !!user?.id,
  });
}

export function useUpdateUserSettings() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<TablesUpdate<"user_profiles">>) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      // Check if settings exist
      const { data: existing } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      
      if (existing) {
        const { data, error } = await supabase
          .from("user_profiles")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            ...updates,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings", user?.id] });
      refreshProfile();
    },
  });
}

export function useUpdateBiometricSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ enabled, deviceInfo }: { enabled: boolean; deviceInfo?: Record<string, string> }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase.rpc("update_biometric_settings", {
        p_user_id: user.id,
        p_enabled: enabled,
        p_device_info: deviceInfo || null,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings", user?.id] });
    },
  });
}
