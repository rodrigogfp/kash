import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────────────────────
// ENCRYPTION UTILITIES (Web Crypto API)
// ─────────────────────────────────────────────────────────────────────────────

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyBase64 = Deno.env.get("ENCRYPTION_KEY");
  if (!keyBase64) {
    throw new Error("ENCRYPTION_KEY not configured");
  }
  
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptToken(token: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encryptedToken: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encryptedToken), (c) => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER ADAPTER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderAdapter {
  createLinkToken(userId: string): Promise<{ linkToken: string; expiresAt: string }>;
  exchangePublicToken(publicToken: string): Promise<{ 
    accessToken: string; 
    refreshToken?: string;
    externalConnectionId: string;
    scopes: string[];
  }>;
  refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
  }>;
  fetchAccounts(accessToken: string): Promise<Array<{
    externalAccountId: string;
    name: string;
    accountType: string;
    currency: string;
    currentBalance: number;
    availableBalance: number;
  }>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLUGGY API CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const PLUGGY_API_URL = "https://api.pluggy.ai";

interface PluggyAuthResponse {
  apiKey: string;
}

interface PluggyConnectTokenResponse {
  accessToken: string;
}

interface PluggyItemResponse {
  id: string;
  connector: {
    id: number;
    name: string;
  };
  status: string;
  executionStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface PluggyAccountResponse {
  id: string;
  name: string;
  type: string;
  subtype: string;
  balance: number;
  currencyCode: string;
  itemId: string;
}

// Get Pluggy API key (authentication)
async function getPluggyApiKey(): Promise<string> {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("Pluggy credentials not configured");
  }
  
  const response = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error("[Pluggy] Auth failed:", error);
    throw new Error("Failed to authenticate with Pluggy");
  }
  
  const data: PluggyAuthResponse = await response.json();
  return data.apiKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLUGGY PROVIDER ADAPTER (Real Open Finance integration)
// ─────────────────────────────────────────────────────────────────────────────

class PluggyProviderAdapter implements ProviderAdapter {
  private connectorId: number;
  
  constructor(connectorId: number) {
    this.connectorId = connectorId;
  }
  
  async createLinkToken(userId: string) {
    console.log(`[Pluggy] Creating connect token for user: ${userId}, connector: ${this.connectorId}`);
    
    const apiKey = await getPluggyApiKey();
    
    const response = await fetch(`${PLUGGY_API_URL}/connect_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        clientUserId: userId,
        // Optional: restrict to specific connector
        // connectorId: this.connectorId,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("[Pluggy] Create connect token failed:", error);
      throw new Error("Failed to create Pluggy connect token");
    }
    
    const data: PluggyConnectTokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min expiry
    
    return {
      linkToken: data.accessToken,
      expiresAt,
    };
  }

  async exchangePublicToken(itemId: string) {
    console.log(`[Pluggy] Getting item details for: ${itemId}`);
    
    const apiKey = await getPluggyApiKey();
    
    // The "public token" in Pluggy's flow is actually the Item ID
    // returned after user completes the widget flow
    const response = await fetch(`${PLUGGY_API_URL}/items/${itemId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("[Pluggy] Get item failed:", error);
      throw new Error("Failed to get Pluggy item");
    }
    
    const item: PluggyItemResponse = await response.json();
    
    // Pluggy doesn't use access/refresh tokens per item - the API key is used
    // We store the item ID as the "access token" for reference
    return {
      accessToken: itemId,
      refreshToken: undefined,
      externalConnectionId: item.id,
      scopes: ["accounts", "identity", "transactions"],
    };
  }

  async refreshTokens(_refreshToken: string) {
    // Pluggy uses API key authentication, no token refresh needed per item
    console.log(`[Pluggy] Token refresh not needed - using API key auth`);
    return {
      accessToken: _refreshToken, // Return the same item ID
      refreshToken: undefined,
    };
  }

  async fetchAccounts(itemId: string) {
    console.log(`[Pluggy] Fetching accounts for item: ${itemId}`);
    
    const apiKey = await getPluggyApiKey();
    
    const response = await fetch(`${PLUGGY_API_URL}/accounts?itemId=${itemId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("[Pluggy] Fetch accounts failed:", error);
      throw new Error("Failed to fetch Pluggy accounts");
    }
    
    const data: { results: PluggyAccountResponse[] } = await response.json();
    
    return data.results.map((acc) => ({
      externalAccountId: acc.id,
      name: acc.name,
      accountType: acc.type.toLowerCase(),
      currency: acc.currencyCode || "BRL",
      currentBalance: acc.balance,
      availableBalance: acc.balance,
    }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTOR ID MAPPING (Pluggy connector IDs for Brazilian banks)
// ─────────────────────────────────────────────────────────────────────────────

const PLUGGY_CONNECTOR_IDS: Record<string, number> = {
  nubank: 201,
  itau: 204,
  bradesco: 206,
  santander: 209,
  bb: 203,
  caixa: 207,
  xp: 232,
  inter: 213,
  c6: 214,
  btg: 219,
};

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function getProviderAdapter(providerKey: string): ProviderAdapter {
  console.log(`[ProviderFactory] Getting Pluggy adapter for: ${providerKey}`);
  
  // Get connector ID for the bank, default to 0 (let Pluggy widget show all)
  const connectorId = PLUGGY_CONNECTOR_IDS[providerKey] || 0;
  
  return new PluggyProviderAdapter(connectorId);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
interface OperationContext {
  supabaseAdmin: SupabaseClient<any, "public", any>;
  userId: string;
}

async function createLinkToken(
  ctx: OperationContext,
  providerKey: string
): Promise<{ linkToken: string; expiresAt: string }> {
  console.log(`[createLinkToken] Starting for provider: ${providerKey}, user: ${ctx.userId}`);

  // Verify provider is supported and enabled
  const { data: bank, error: bankError } = await ctx.supabaseAdmin
    .from("supported_banks")
    .select("*")
    .eq("provider_key", providerKey)
    .eq("enabled", true)
    .single();

  if (bankError || !bank) {
    console.error(`[createLinkToken] Provider not found or disabled: ${providerKey}`);
    throw new Error(`Provider not supported: ${providerKey}`);
  }

  const adapter = getProviderAdapter(providerKey);
  const result = await adapter.createLinkToken(ctx.userId);

  // Log audit event
  await ctx.supabaseAdmin.from("audit_events").insert({
    user_id: ctx.userId,
    event_type: "bank_link_initiated",
    payload: { provider_key: providerKey, expires_at: result.expiresAt },
  });

  console.log(`[createLinkToken] Success for provider: ${providerKey}`);
  return result;
}

async function exchangePublicToken(
  ctx: OperationContext,
  providerKey: string,
  publicToken: string
): Promise<{ connectionId: string; accountCount: number }> {
  console.log(`[exchangePublicToken] Starting for provider: ${providerKey}`);

  const adapter = getProviderAdapter(providerKey);
  
  // Exchange token with provider
  const tokenResult = await adapter.exchangePublicToken(publicToken);
  console.log(`[exchangePublicToken] Token exchanged, connection: ${tokenResult.externalConnectionId}`);

  // Encrypt tokens before storing
  const accessTokenEncrypted = await encryptToken(tokenResult.accessToken);
  const refreshTokenEncrypted = tokenResult.refreshToken 
    ? await encryptToken(tokenResult.refreshToken) 
    : null;

  // Create bank connection record
  const { data: connection, error: connError } = await ctx.supabaseAdmin
    .from("bank_connections")
    .insert({
      user_id: ctx.userId,
      provider_key: providerKey,
      external_connection_id: tokenResult.externalConnectionId,
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      scopes: tokenResult.scopes,
      status: "active",
      last_sync: new Date().toISOString(),
    })
    .select()
    .single();

  if (connError) {
    console.error(`[exchangePublicToken] Failed to create connection:`, connError);
    throw new Error("Failed to create bank connection");
  }

  console.log(`[exchangePublicToken] Connection created: ${connection.id}`);

  // Fetch and store accounts
  const accounts = await adapter.fetchAccounts(tokenResult.accessToken);
  console.log(`[exchangePublicToken] Fetched ${accounts.length} accounts`);

  const accountInserts = accounts.map((acc) => ({
    connection_id: connection.id,
    external_account_id: acc.externalAccountId,
    name: acc.name,
    account_type: acc.accountType,
    currency: acc.currency,
    current_balance: acc.currentBalance,
    available_balance: acc.availableBalance,
    last_balance_update: new Date().toISOString(),
  }));

  const { error: accError } = await ctx.supabaseAdmin
    .from("bank_accounts")
    .insert(accountInserts);

  if (accError) {
    console.error(`[exchangePublicToken] Failed to insert accounts:`, accError);
    // Don't fail completely, connection is still valid
  }

  const connectionId = connection.id as string;

  // Log audit event
  await ctx.supabaseAdmin.from("audit_events").insert({
    user_id: ctx.userId,
    event_type: "bank_connected",
    payload: { 
      provider_key: providerKey, 
      connection_id: connection.id,
      account_count: accounts.length,
    },
  });

  console.log(`[exchangePublicToken] Complete - connection: ${connectionId}, accounts: ${accounts.length}`);
  return { connectionId, accountCount: accounts.length };
}

async function refreshConnectionTokens(
  ctx: OperationContext,
  connectionId: string
): Promise<{ success: boolean }> {
  console.log(`[refreshConnectionTokens] Starting for connection: ${connectionId}`);

  // Fetch connection with service role (can read encrypted tokens)
  const { data: connection, error: connError } = await ctx.supabaseAdmin
    .from("bank_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (connError || !connection) {
    console.error(`[refreshConnectionTokens] Connection not found: ${connectionId}`);
    throw new Error("Connection not found");
  }

  // Verify user owns this connection
  if (connection.user_id !== ctx.userId) {
    console.error(`[refreshConnectionTokens] User ${ctx.userId} doesn't own connection ${connectionId}`);
    throw new Error("Unauthorized");
  }

  if (!connection.refresh_token_encrypted) {
    console.error(`[refreshConnectionTokens] No refresh token available`);
    throw new Error("No refresh token available");
  }

  // Decrypt refresh token
  const refreshToken = await decryptToken(connection.refresh_token_encrypted as string);
  
  // Refresh with provider
  const adapter = getProviderAdapter(connection.provider_key as string);
  const newTokens = await adapter.refreshTokens(refreshToken);

  // Encrypt new tokens
  const newAccessTokenEncrypted = await encryptToken(newTokens.accessToken);
  const newRefreshTokenEncrypted = newTokens.refreshToken 
    ? await encryptToken(newTokens.refreshToken) 
    : connection.refresh_token_encrypted;

  // Update connection
  const { error: updateError } = await ctx.supabaseAdmin
    .from("bank_connections")
    .update({
      access_token_encrypted: newAccessTokenEncrypted,
      refresh_token_encrypted: newRefreshTokenEncrypted,
      status: "active",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  if (updateError) {
    console.error(`[refreshConnectionTokens] Failed to update connection:`, updateError);
    throw new Error("Failed to update connection tokens");
  }

  // Log audit event
  await ctx.supabaseAdmin.from("audit_events").insert({
    user_id: ctx.userId,
    event_type: "bank_tokens_refreshed",
    payload: { connection_id: connectionId },
  });

  console.log(`[refreshConnectionTokens] Success for connection: ${connectionId}`);
  return { success: true };
}

async function initiateSync(
  ctx: OperationContext,
  connectionId: string,
  mode: "full" | "incremental" = "incremental"
): Promise<{ jobId: string }> {
  console.log(`[initiateSync] Starting ${mode} sync for connection: ${connectionId}`);

  // Verify connection exists and user owns it
  const { data: connection, error: connError } = await ctx.supabaseAdmin
    .from("bank_connections")
    .select("id, user_id, status")
    .eq("id", connectionId)
    .single();

  if (connError || !connection) {
    console.error(`[initiateSync] Connection not found: ${connectionId}`);
    throw new Error("Connection not found");
  }

  if (connection.user_id !== ctx.userId) {
    console.error(`[initiateSync] User ${ctx.userId} doesn't own connection ${connectionId}`);
    throw new Error("Unauthorized");
  }

  if (connection.status !== "active") {
    console.error(`[initiateSync] Connection not active: ${connection.status}`);
    throw new Error(`Connection status is ${connection.status}, cannot sync`);
  }

  // Check for existing pending/running job
  const { data: existingJobs } = await ctx.supabaseAdmin
    .from("sync_jobs")
    .select("id, status")
    .eq("connection_id", connectionId)
    .in("status", ["pending", "running"])
    .limit(1);

  if (existingJobs && existingJobs.length > 0) {
    console.log(`[initiateSync] Existing job found: ${existingJobs[0].id}`);
    return { jobId: existingJobs[0].id as string };
  }

  // Create new sync job
  const { data: job, error: jobError } = await ctx.supabaseAdmin
    .from("sync_jobs")
    .insert({
      connection_id: connectionId,
      job_type: mode === "full" ? "full_sync" : "incremental_sync",
      status: "pending",
      scheduled_at: new Date().toISOString(),
      payload: { mode, initiated_by: ctx.userId },
    })
    .select()
    .single();

  if (jobError) {
    console.error(`[initiateSync] Failed to create job:`, jobError);
    throw new Error("Failed to create sync job");
  }

  const jobId = job.id as string;

  // Log audit event
  await ctx.supabaseAdmin.from("audit_events").insert({
    user_id: ctx.userId,
    event_type: "sync_initiated",
    payload: { connection_id: connectionId, job_id: jobId, mode },
  });

  console.log(`[initiateSync] Job created: ${jobId}`);
  return { jobId };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[Handler] Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("[Handler] Invalid token:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Handler] Authenticated user: ${user.id}`);

    // Parse request
    const { action, ...params } = await req.json();
    console.log(`[Handler] Action: ${action}, Params:`, JSON.stringify(params));

    const ctx: OperationContext = {
      supabaseAdmin,
      userId: user.id,
    };

    let result: unknown;

    switch (action) {
      case "create_link_token":
        if (!params.provider_key) {
          throw new Error("provider_key is required");
        }
        result = await createLinkToken(ctx, params.provider_key);
        break;

      case "exchange_public_token":
        if (!params.provider_key || !params.public_token) {
          throw new Error("provider_key and public_token are required");
        }
        result = await exchangePublicToken(ctx, params.provider_key, params.public_token);
        break;

      case "refresh_connection_tokens":
        if (!params.connection_id) {
          throw new Error("connection_id is required");
        }
        result = await refreshConnectionTokens(ctx, params.connection_id);
        break;

      case "initiate_sync":
        if (!params.connection_id) {
          throw new Error("connection_id is required");
        }
        result = await initiateSync(ctx, params.connection_id, params.mode);
        break;

      default:
        console.error(`[Handler] Unknown action: ${action}`);
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[Handler] Action ${action} completed successfully`);
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Handler] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
