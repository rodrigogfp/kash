 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
 };
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
   const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
   const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
   const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 
   if (!stripeSecretKey) {
     console.error('STRIPE_SECRET_KEY not configured');
     return new Response(JSON.stringify({ error: 'Server configuration error' }), {
       status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
   }
 
   const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
   const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
   try {
     const signature = req.headers.get('stripe-signature');
     const body = await req.text();
 
     let event: Stripe.Event;
 
     // Verify webhook signature if secret is configured
     if (webhookSecret && signature) {
       try {
         event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
         console.log(`Webhook verified: ${event.type}`);
       } catch (err: unknown) {
         const errMessage = err instanceof Error ? err.message : 'Unknown error';
         console.error('Webhook signature verification failed:', errMessage);
         return new Response(JSON.stringify({ error: 'Invalid signature' }), {
           status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
     } else {
       // For development without webhook secret
       event = JSON.parse(body);
       console.log(`Webhook (unverified): ${event.type}`);
     }
 
     // Process events with idempotency check
     const eventId = event.id;
     const { data: existingEvent } = await supabase
       .from('audit_events')
       .select('id')
       .eq('event_type', `stripe_${event.type}`)
       .eq('payload->>stripe_event_id', eventId)
       .maybeSingle();
 
     if (existingEvent) {
       console.log(`Event already processed: ${eventId}`);
       return new Response(JSON.stringify({ received: true, duplicate: true }), {
         status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }
 
     // Handle specific event types
     switch (event.type) {
       case 'checkout.session.completed': {
         const session = event.data.object as Stripe.Checkout.Session;
         await handleCheckoutComplete(supabase, stripe, session);
         break;
       }
 
       case 'customer.subscription.created':
       case 'customer.subscription.updated': {
         const subscription = event.data.object as Stripe.Subscription;
         await handleSubscriptionUpdate(supabase, subscription);
         break;
       }
 
       case 'customer.subscription.deleted': {
         const subscription = event.data.object as Stripe.Subscription;
         await handleSubscriptionCanceled(supabase, subscription);
         break;
       }
 
       case 'invoice.paid': {
         const invoice = event.data.object as Stripe.Invoice;
         await handleInvoicePaid(supabase, invoice);
         break;
       }
 
       case 'invoice.payment_failed': {
         const invoice = event.data.object as Stripe.Invoice;
         await handleInvoiceFailed(supabase, invoice);
         break;
       }
 
       default:
         console.log(`Unhandled event type: ${event.type}`);
     }
 
     // Log processed event for idempotency
     const userId = extractUserId(event);
     await supabase.from('audit_events').insert({
       user_id: userId,
       event_type: `stripe_${event.type}`,
       payload: { stripe_event_id: eventId, type: event.type }
     });
 
     return new Response(JSON.stringify({ received: true }), {
       status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
 
   } catch (error: unknown) {
     console.error('Webhook processing error:', error);
     const errorMessage = error instanceof Error ? error.message : 'Internal server error';
     return new Response(JSON.stringify({ error: errorMessage }), {
       status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
   }
 });
 
 function extractUserId(event: Stripe.Event): string | null {
   const obj = event.data.object as any;
   return obj?.metadata?.user_id || null;
 }
 
 async function handleCheckoutComplete(supabase: any, stripe: Stripe, session: Stripe.Checkout.Session) {
   const userId = session.metadata?.user_id;
   const planId = session.metadata?.plan_id;
   const planSlug = session.metadata?.plan_slug;
   const customerId = session.customer as string;
   const subscriptionId = session.subscription as string;
 
   if (!userId || !subscriptionId) {
     console.error('Missing user_id or subscription_id in checkout session');
     return;
   }
 
   console.log(`Checkout complete for user ${userId}, subscription ${subscriptionId}`);
 
   // Get subscription details from Stripe
   const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
 
   // Upsert subscription record
   const { error } = await supabase
     .from('subscriptions')
     .upsert({
       user_id: userId,
       plan_id: planId,
       plan: planSlug || 'pro',
       stripe_customer_id: customerId,
       stripe_subscription_id: subscriptionId,
       status: stripeSubscription.status,
       current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
       current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
       cancel_at_period_end: stripeSubscription.cancel_at_period_end,
       updated_at: new Date().toISOString(),
     }, { onConflict: 'user_id' });
 
   if (error) {
     console.error('Error upserting subscription:', error);
     throw error;
   }
 
   console.log(`Subscription created/updated for user ${userId}`);
 }
 
 async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
   const userId = subscription.metadata?.user_id;
   const planSlug = subscription.metadata?.plan_slug;
 
   if (!userId) {
     console.log('No user_id in subscription metadata, skipping');
     return;
   }
 
   console.log(`Subscription update for user ${userId}: ${subscription.status}`);
 
   const { error } = await supabase
     .from('subscriptions')
     .update({
       status: subscription.status,
       plan: planSlug || 'pro',
       current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
       current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
       cancel_at_period_end: subscription.cancel_at_period_end,
       updated_at: new Date().toISOString(),
     })
     .eq('user_id', userId);
 
   if (error) {
     console.error('Error updating subscription:', error);
     throw error;
   }
 }
 
 async function handleSubscriptionCanceled(supabase: any, subscription: Stripe.Subscription) {
   const userId = subscription.metadata?.user_id;
 
   if (!userId) {
     console.log('No user_id in subscription metadata, skipping');
     return;
   }
 
   console.log(`Subscription canceled for user ${userId}`);
 
   const { error } = await supabase
     .from('subscriptions')
     .update({
       status: 'canceled',
       plan: 'free',
       cancel_at_period_end: false,
       updated_at: new Date().toISOString(),
     })
     .eq('user_id', userId);
 
   if (error) {
     console.error('Error canceling subscription:', error);
     throw error;
   }
 }
 
 async function handleInvoicePaid(supabase: any, invoice: Stripe.Invoice) {
   const subscriptionId = invoice.subscription as string;
   if (!subscriptionId) return;
 
   // Find subscription by stripe_subscription_id
   const { data: subscription } = await supabase
     .from('subscriptions')
     .select('id, user_id')
     .eq('stripe_subscription_id', subscriptionId)
     .maybeSingle();
 
   if (!subscription) {
     console.log('Subscription not found for invoice');
     return;
   }
 
   console.log(`Invoice paid for subscription ${subscriptionId}`);
 
   // Create invoice record
   const { error } = await supabase
     .from('invoices')
     .upsert({
       subscription_id: subscription.id,
       user_id: subscription.user_id,
       invoice_provider_id: invoice.id,
       amount_cents: invoice.amount_paid,
       currency: invoice.currency.toUpperCase(),
       status: 'paid',
       paid_at: invoice.status_transitions?.paid_at 
         ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() 
         : new Date().toISOString(),
       period_start: invoice.period_start 
         ? new Date(invoice.period_start * 1000).toISOString() 
         : null,
       period_end: invoice.period_end 
         ? new Date(invoice.period_end * 1000).toISOString() 
         : null,
       hosted_invoice_url: invoice.hosted_invoice_url,
       pdf_url: invoice.invoice_pdf,
       updated_at: new Date().toISOString(),
     }, { onConflict: 'invoice_provider_id' });
 
   if (error) {
     console.error('Error creating invoice:', error);
     throw error;
   }
 }
 
 async function handleInvoiceFailed(supabase: any, invoice: Stripe.Invoice) {
   const subscriptionId = invoice.subscription as string;
   if (!subscriptionId) return;
 
   const { data: subscription } = await supabase
     .from('subscriptions')
     .select('id, user_id')
     .eq('stripe_subscription_id', subscriptionId)
     .maybeSingle();
 
   if (!subscription) return;
 
   console.log(`Invoice failed for subscription ${subscriptionId}`);
 
   // Update subscription status to past_due
   await supabase
     .from('subscriptions')
     .update({ status: 'past_due', updated_at: new Date().toISOString() })
     .eq('id', subscription.id);
 
   // Create failed invoice record
   await supabase
     .from('invoices')
     .upsert({
       subscription_id: subscription.id,
       user_id: subscription.user_id,
       invoice_provider_id: invoice.id,
       amount_cents: invoice.amount_due,
       currency: invoice.currency.toUpperCase(),
       status: 'failed',
       hosted_invoice_url: invoice.hosted_invoice_url,
       updated_at: new Date().toISOString(),
     }, { onConflict: 'invoice_provider_id' });
 }