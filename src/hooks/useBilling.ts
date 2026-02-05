 import { useState } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 
 export function useBilling() {
   const [isLoading, setIsLoading] = useState(false);
   const { toast } = useToast();
 
   const createCheckoutSession = async (planSlug: string) => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('stripe-checkout', {
         body: {
           plan_slug: planSlug,
           success_url: `${window.location.origin}/settings/billing?success=true`,
           cancel_url: `${window.location.origin}/settings/billing?canceled=true`,
         },
       });
 
       if (error) throw error;
 
       if (data?.url) {
         window.location.href = data.url;
       } else {
         throw new Error('No checkout URL returned');
       }
     } catch (error) {
       console.error('Checkout error:', error);
       toast({
         variant: "destructive",
         title: "Erro ao iniciar checkout",
         description: error instanceof Error ? error.message : "Tente novamente mais tarde",
       });
     } finally {
       setIsLoading(false);
     }
   };
 
   const openBillingPortal = async () => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('stripe-portal', {
         body: {
           return_url: `${window.location.origin}/settings/billing`,
         },
       });
 
       if (error) throw error;
 
       if (data?.url) {
         window.location.href = data.url;
       } else {
         throw new Error('No portal URL returned');
       }
     } catch (error) {
       console.error('Portal error:', error);
       toast({
         variant: "destructive",
         title: "Erro ao abrir portal de pagamento",
         description: error instanceof Error ? error.message : "Tente novamente mais tarde",
       });
     } finally {
       setIsLoading(false);
     }
   };
 
   const cancelSubscription = async (immediately = false) => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('stripe-cancel', {
         body: { cancel_immediately: immediately },
       });
 
       if (error) throw error;
 
       toast({
         title: immediately ? "Assinatura cancelada" : "Cancelamento agendado",
         description: immediately 
           ? "Sua assinatura foi cancelada imediatamente."
           : `Sua assinatura será cancelada ao final do período atual.`,
       });
 
       return data;
     } catch (error) {
       console.error('Cancel error:', error);
       toast({
         variant: "destructive",
         title: "Erro ao cancelar assinatura",
         description: error instanceof Error ? error.message : "Tente novamente mais tarde",
       });
       throw error;
     } finally {
       setIsLoading(false);
     }
   };
 
   return {
     isLoading,
     createCheckoutSession,
     openBillingPortal,
     cancelSubscription,
   };
 }