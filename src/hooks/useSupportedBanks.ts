import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type SupportedBank = Tables<"supported_banks">;

export function useSupportedBanks() {
  return useQuery({
    queryKey: ["supported-banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supported_banks")
        .select("*")
        .eq("enabled", true)
        .order("display_name");

      if (error) {
        throw new Error(error.message);
      }

      return data as SupportedBank[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
