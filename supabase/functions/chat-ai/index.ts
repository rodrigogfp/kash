import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_CONTEXT_MESSAGES = 20;
const MAX_RESPONSE_TOKENS = 1024;

interface ChatRequest {
  action: "create_session" | "send_message" | "get_history" | "quick_chips";
  session_id?: string;
  title?: string;
  context?: Record<string, unknown>;
  message?: string;
  page?: number;
  page_size?: number;
}

// Build financial context for the AI from user's data
async function buildFinancialContext(supabaseAdmin: SupabaseClient, userId: string): Promise<string> {
  console.log("[chat-ai] Building financial context for user:", userId);
  
  try {
    // Get user balance - use any to bypass type checking for RPC
    const { data: balanceData } = await (supabaseAdmin as any)
      .rpc("get_user_balance", { user_uuid: userId });
    
    const balance = balanceData?.[0] as { total_balance?: number; account_count?: number; last_sync?: string } | undefined;
    
    // Get spending by category (current month)
    const { data: spendingData } = await (supabaseAdmin as any)
      .rpc("get_spending_by_category", { p_user_id: userId });
    
    // Get monthly trend (last 3 months)
    const { data: trendData } = await (supabaseAdmin as any)
      .rpc("get_monthly_trend", { p_user_id: userId, p_months: 3 });
    
    // Get recent transactions (last 10, summarized)
    const { data: recentTx } = await supabaseAdmin
      .from("transactions")
      .select(`
        amount,
        category,
        merchant_name,
        posted_at,
        bank_accounts!inner(
          connection_id,
          bank_connections!inner(user_id)
        )
      `)
      .eq("bank_accounts.bank_connections.user_id", userId)
      .order("posted_at", { ascending: false })
      .limit(10);
    
    // Build context summary (redacted, no PII)
    const contextParts: string[] = [];
    
    if (balance) {
      contextParts.push(`Saldo total: R$ ${balance.total_balance?.toFixed(2) || "0.00"}`);
      contextParts.push(`Número de contas: ${balance.account_count || 0}`);
      if (balance.last_sync) {
        contextParts.push(`Última sincronização: ${new Date(balance.last_sync).toLocaleDateString("pt-BR")}`);
      }
    }
    
    if (spendingData && Array.isArray(spendingData) && spendingData.length > 0) {
      const topCategories = spendingData.slice(0, 5).map((c: any) => 
        `${c.category || "Outros"}: R$ ${c.total_amount?.toFixed(2)} (${c.percentage}%)`
      );
      contextParts.push(`\nGastos por categoria (mês atual):\n${topCategories.join("\n")}`);
    }
    
    if (trendData && Array.isArray(trendData) && trendData.length > 0) {
      const trends = trendData.map((t: any) => {
        const month = new Date(t.month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return `${month}: Receita R$ ${t.income?.toFixed(2)}, Despesas R$ ${t.expenses?.toFixed(2)}, Líquido R$ ${t.net?.toFixed(2)}`;
      });
      contextParts.push(`\nTendência mensal:\n${trends.join("\n")}`);
    }
    
    if (recentTx && Array.isArray(recentTx) && recentTx.length > 0) {
      const txSummary = recentTx.slice(0, 5).map((tx: any) => {
        const date = new Date(tx.posted_at).toLocaleDateString("pt-BR");
        const merchant = tx.merchant_name || tx.category || "Transação";
        const amount = tx.amount < 0 ? `-R$ ${Math.abs(tx.amount).toFixed(2)}` : `+R$ ${tx.amount.toFixed(2)}`;
        return `${date}: ${merchant} ${amount}`;
      });
      contextParts.push(`\nTransações recentes:\n${txSummary.join("\n")}`);
    }
    
    return contextParts.length > 0 ? contextParts.join("\n") : "Nenhum dado financeiro disponível ainda.";
  } catch (error) {
    console.error("[chat-ai] Error building context:", error);
    return "Erro ao carregar dados financeiros.";
  }
}

// Build system prompt with financial context
function buildSystemPrompt(financialContext: string): string {
  return `Você é o Kash, um assistente financeiro inteligente e amigável. Você ajuda usuários a entender suas finanças pessoais de forma clara e acessível.

CONTEXTO FINANCEIRO DO USUÁRIO:
${financialContext}

INSTRUÇÕES:
- Responda sempre em português brasileiro
- Seja conciso mas informativo
- Use os dados financeiros acima para responder perguntas sobre saldos, gastos e tendências
- Se não tiver dados suficientes, sugira que o usuário conecte mais contas
- Não invente dados - use apenas o que está no contexto
- Formate valores monetários como "R$ X.XXX,XX"
- Para análises, destaque insights relevantes e sugestões práticas
- Seja encorajador e positivo, mas honesto sobre a situação financeira
- Não peça informações sensíveis como senhas ou dados bancários completos
- Limite respostas a 2-3 parágrafos quando possível`;
}

// Log audit event (without sensitive content)
async function logAuditEvent(
  supabaseAdmin: SupabaseClient,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin.from("audit_events").insert({
      user_id: userId,
      event_type: eventType,
      payload,
    } as any);
  } catch (error) {
    console.error("[chat-ai] Failed to log audit event:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("[chat-ai] Auth error:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log("[chat-ai] Authenticated user:", userId);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: ChatRequest = await req.json();
    const { action } = body;

    console.log("[chat-ai] Action:", action);

    // === CREATE SESSION ===
    if (action === "create_session") {
      const { title, context } = body;
      
      const { data: session, error } = await supabaseAdmin
        .from("chat_sessions")
        .insert({
          user_id: userId,
          title: title || "Nova conversa",
          context: context || {},
        })
        .select()
        .single();

      if (error) {
        console.error("[chat-ai] Create session error:", error);
        throw error;
      }

      await logAuditEvent(supabaseAdmin, userId, "chat_session_created", {
        session_id: session.id,
      });

      return new Response(JSON.stringify({ session }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === QUICK CHIPS ===
    if (action === "quick_chips") {
      const { data: chips, error } = await supabaseAdmin
        .from("quick_chips")
        .select("id, text, category")
        .eq("enabled", true)
        .order("ordering", { ascending: true });

      if (error) {
        console.error("[chat-ai] Quick chips error:", error);
        throw error;
      }

      return new Response(JSON.stringify({ chips }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === GET HISTORY ===
    if (action === "get_history") {
      const { session_id, page = 0, page_size = 50 } = body;

      if (!session_id) {
        return new Response(JSON.stringify({ error: "session_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      const { data: session } = await supabaseAdmin
        .from("chat_sessions")
        .select("user_id")
        .eq("id", session_id)
        .single();

      if (!session || session.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: messages, error } = await supabaseAdmin
        .from("chat_messages")
        .select("id, role, content, created_at, metadata")
        .eq("session_id", session_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .range(page * page_size, (page + 1) * page_size - 1);

      if (error) {
        console.error("[chat-ai] Get history error:", error);
        throw error;
      }

      return new Response(JSON.stringify({ messages, page, page_size }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === SEND MESSAGE (with streaming) ===
    if (action === "send_message") {
      const { session_id, message } = body;

      if (!session_id || !message?.trim()) {
        return new Response(JSON.stringify({ error: "session_id and message required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify session ownership
      const { data: session } = await supabaseAdmin
        .from("chat_sessions")
        .select("user_id, context")
        .eq("id", session_id)
        .single();

      if (!session || session.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert user message
      const { data: userMessage, error: userMsgError } = await supabaseAdmin
        .from("chat_messages")
        .insert({
          session_id,
          role: "user",
          content: message.trim(),
          metadata: {},
        })
        .select()
        .single();

      if (userMsgError) {
        console.error("[chat-ai] Insert user message error:", userMsgError);
        throw userMsgError;
      }

      // Get recent messages for context
      const { data: recentMessages } = await supabaseAdmin
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(MAX_CONTEXT_MESSAGES);

      const chatHistory = (recentMessages || [])
        .reverse()
        .map((m: any) => ({ role: m.role, content: m.content }));

      // Build financial context
      const financialContext = await buildFinancialContext(supabaseAdmin, userId);
      const systemPrompt = buildSystemPrompt(financialContext);

      console.log("[chat-ai] Calling Lovable AI Gateway...");

      // Call Lovable AI Gateway with streaming
      const aiResponse = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory,
          ],
          stream: true,
          max_tokens: MAX_RESPONSE_TOKENS,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("[chat-ai] AI Gateway error:", aiResponse.status, errorText);

        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        throw new Error(`AI Gateway error: ${aiResponse.status}`);
      }

      // Log audit event (without content)
      await logAuditEvent(supabaseAdmin, userId, "chat_message_sent", {
        session_id,
        user_message_id: userMessage.id,
        message_length: message.length,
      });

      // Stream the response
      const reader = aiResponse.body?.getReader();
      if (!reader) {
        throw new Error("No response body from AI");
      }

      const decoder = new TextDecoder();
      let fullContent = "";
      let tokenCount = 0;

      // Create a TransformStream to process and forward the SSE
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Process stream in background
      (async () => {
        try {
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);

              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (line.startsWith(":") || line.trim() === "") continue;
              if (!line.startsWith("data: ")) continue;

              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
                break;
              }

              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                  tokenCount++;
                  // Forward the SSE event
                  await writer.write(encoder.encode(`data: ${jsonStr}\n\n`));
                }
              } catch {
                // Incomplete JSON, put back and wait
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }

          // Save assistant message after streaming completes
          if (fullContent) {
            await supabaseAdmin.from("chat_messages").insert({
              session_id,
              role: "assistant",
              content: fullContent,
              tokens: tokenCount,
              metadata: { model: "google/gemini-3-flash-preview" },
            });

            // Update session title if it's the first message
            const { data: msgCount } = await supabaseAdmin
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .eq("session_id", session_id);

            if (msgCount && (msgCount as any).length <= 2) {
              // Auto-generate title from first user message
              const shortTitle = message.slice(0, 50) + (message.length > 50 ? "..." : "");
              await supabaseAdmin
                .from("chat_sessions")
                .update({ title: shortTitle })
                .eq("id", session_id);
            }
          }

          await writer.close();
        } catch (error) {
          console.error("[chat-ai] Stream processing error:", error);
          await writer.abort(error);
        }
      })();

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[chat-ai] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
