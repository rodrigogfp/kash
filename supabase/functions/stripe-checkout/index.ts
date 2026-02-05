 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 serve(async (req) => {
   // Handle CORS preflight
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get('Authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       console.error('Missing or invalid authorization header');
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
     const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
 
     if (!stripeSecretKey) {
       console.error('STRIPE_SECRET_KEY not configured');
       return new Response(
         JSON.stringify({ error: 'Payment service not configured' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } }
     });
 
     // Verify user
     const token = authHeader.replace('Bearer ', '');
     const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
     if (claimsError || !claimsData?.user) {
       console.error('Auth error:', claimsError);
       return new Response(
         JSON.stringify({ error: 'Unauthorized' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const userId = claimsData.user.id;
     const userEmail = claimsData.user.email;
     console.log(`Processing checkout for user: ${userId}`);
 
     const { plan_slug, success_url, cancel_url } = await req.json();
 
     if (!plan_slug) {
       return new Response(
         JSON.stringify({ error: 'plan_slug is required' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Get plan details
     const { data: plan, error: planError } = await supabase
       .from('plans')
       .select('*')
       .eq('slug', plan_slug)
       .eq('is_active', true)
       .single();
 
     if (planError || !plan) {
       console.error('Plan not found:', planError);
       return new Response(
         JSON.stringify({ error: 'Plan not found' }),
         { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const stripe = new Stripe(stripeSecretKey, {
       apiVersion: '2023-10-16',
     });
 
     // Check if user already has a Stripe customer
     const { data: subscription } = await supabase
       .from('subscriptions')
       .select('stripe_customer_id')
       .eq('user_id', userId)
       .maybeSingle();
 
     let customerId = subscription?.stripe_customer_id;
 
     // Create or retrieve Stripe customer
     if (!customerId) {
       const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
       if (customers.data.length > 0) {
         customerId = customers.data[0].id;
       } else {
         const customer = await stripe.customers.create({
           email: userEmail,
           metadata: { user_id: userId }
         });
         customerId = customer.id;
       }
       console.log(`Customer ID: ${customerId}`);
     }
 
     // Create checkout session
     const session = await stripe.checkout.sessions.create({
       customer: customerId,
       payment_method_types: ['card'],
       mode: 'subscription',
       line_items: [{
         price_data: {
           currency: plan.currency.toLowerCase(),
           product_data: {
             name: plan.display_name,
             description: plan.description || undefined,
           },
           unit_amount: plan.price_cents,
           recurring: {
             interval: plan.billing_interval === 'yearly' ? 'year' : 'month',
           },
         },
         quantity: 1,
       }],
       success_url: success_url || `${req.headers.get('origin')}/settings/billing?success=true`,
       cancel_url: cancel_url || `${req.headers.get('origin')}/settings/billing?canceled=true`,
       metadata: {
         user_id: userId,
         plan_id: plan.id,
         plan_slug: plan.slug,
       },
       subscription_data: {
         metadata: {
           user_id: userId,
           plan_id: plan.id,
           plan_slug: plan.slug,
         },
       },
     });
 
     console.log(`Checkout session created: ${session.id}`);
 
     return new Response(
       JSON.stringify({ url: session.url, session_id: session.id }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error: unknown) {
     console.error('Checkout error:', error);
     const errorMessage = error instanceof Error ? error.message : 'Internal server error';
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });