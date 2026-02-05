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
     console.log(`Processing subscription cancellation for user: ${userId}`);
 
     const { cancel_immediately = false } = await req.json().catch(() => ({}));
 
     // Get user's subscription
     const { data: subscription, error: subError } = await supabase
       .from('subscriptions')
       .select('*')
       .eq('user_id', userId)
       .maybeSingle();
 
     if (subError || !subscription) {
       return new Response(
         JSON.stringify({ error: 'Subscription not found' }),
         { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     if (!subscription.stripe_subscription_id) {
       return new Response(
         JSON.stringify({ error: 'No active Stripe subscription' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
 
     let updatedSubscription;
     
     if (cancel_immediately) {
       // Cancel immediately
       updatedSubscription = await stripe.subscriptions.cancel(
         subscription.stripe_subscription_id
       );
       console.log(`Subscription canceled immediately: ${subscription.stripe_subscription_id}`);
     } else {
       // Cancel at period end
       updatedSubscription = await stripe.subscriptions.update(
         subscription.stripe_subscription_id,
         { cancel_at_period_end: true }
       );
       console.log(`Subscription set to cancel at period end: ${subscription.stripe_subscription_id}`);
     }
 
     // Update local subscription record
     const updateData = cancel_immediately
       ? { status: 'canceled', plan: 'free', cancel_at_period_end: false }
       : { cancel_at_period_end: true };
 
     const { error: updateError } = await supabase
       .from('subscriptions')
       .update({ ...updateData, updated_at: new Date().toISOString() })
       .eq('user_id', userId);
 
     if (updateError) {
       console.error('Error updating local subscription:', updateError);
     }
 
     // Log audit event
     await supabase.from('audit_events').insert({
       user_id: userId,
       event_type: 'subscription_cancel',
       payload: { 
         cancel_immediately, 
         stripe_subscription_id: subscription.stripe_subscription_id,
         cancel_at_period_end: !cancel_immediately
       }
     });
 
     return new Response(
       JSON.stringify({
         success: true,
         status: updatedSubscription.status,
         cancel_at_period_end: updatedSubscription.cancel_at_period_end,
         current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString()
       }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error: unknown) {
     console.error('Cancel error:', error);
     const errorMessage = error instanceof Error ? error.message : 'Internal server error';
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });