 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get('Authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
     const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
 
     if (!stripeSecretKey) {
       return new Response(
         JSON.stringify({ error: 'Payment service not configured' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } }
     });
 
     const token = authHeader.replace('Bearer ', '');
     const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
     if (claimsError || !claimsData?.user) {
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const userId = claimsData.user.id;
     console.log(`Creating billing portal for user: ${userId}`);
 
     // Get user's Stripe customer ID
     const { data: subscription } = await supabase
       .from('subscriptions')
       .select('stripe_customer_id')
       .eq('user_id', userId)
       .maybeSingle();
 
     if (!subscription?.stripe_customer_id) {
       return new Response(
         JSON.stringify({ error: 'No billing account found. Please subscribe first.' }),
         { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
 
     const { return_url } = await req.json().catch(() => ({}));
 
     const portalSession = await stripe.billingPortal.sessions.create({
       customer: subscription.stripe_customer_id,
       return_url: return_url || `${req.headers.get('origin')}/settings/billing`,
     });
 
     console.log(`Portal session created: ${portalSession.id}`);
 
     return new Response(
       JSON.stringify({ url: portalSession.url }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error: unknown) {
     console.error('Portal error:', error);
     const errorMessage = error instanceof Error ? error.message : 'Internal server error';
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });