import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useChangePassword() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      currentPassword, 
      newPassword 
    }: { 
      currentPassword: string; 
      newPassword: string;
    }) => {
      if (!user?.email) throw new Error("Not authenticated");
      
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      
      if (signInError) {
        throw new Error("Senha atual incorreta");
      }
      
      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (updateError) throw updateError;
      
      // Log password change for audit
      await supabase.rpc("log_password_change", {
        p_user_id: user.id,
        p_method: "manual",
      });
      
      return { success: true };
    },
  });
}

export function useSecurityOverview() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase.rpc("get_security_overview", {
        p_user_id: user.id,
      });
      
      if (error) throw error;
      return data as {
        auth_methods: string[];
        active_connections: number;
        biometric_enabled: boolean;
        two_factor_enabled: boolean;
        last_password_change: string | null;
        recent_access: Array<{
          id: string;
          action: string;
          bank_name: string | null;
          created_at: string;
        }>;
      };
    },
  });
}

export function useBankAccessHistory() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (limit: number = 10) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("bank_access_audit")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data;
    },
  });
}
