import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  action: 'generate' | 'get_signed_url' | 'status';
  report_id?: string;
  report_type?: 'monthly' | 'annual' | 'tax' | 'export';
  period_start?: string;
  period_end?: string;
  file_format?: 'pdf' | 'csv';
  title?: string;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  posted_at: string;
  description: string | null;
  merchant_name: string | null;
  category: string | null;
}

interface AnalyticsSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  by_category: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ReportRequest = await req.json();
    console.log(`[generate-report] Action: ${body.action}, User: ${user.id}`);

    switch (body.action) {
      case 'generate':
        return await handleGenerate(supabaseAdmin as SupabaseClientAny, user.id, body);
      case 'get_signed_url':
        return await handleGetSignedUrl(supabaseAdmin as SupabaseClientAny, user.id, body.report_id!);
      case 'status':
        return await handleGetStatus(supabaseAdmin as SupabaseClientAny, user.id, body.report_id!);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('[generate-report] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleGenerate(
  supabase: SupabaseClientAny,
  userId: string,
  request: ReportRequest
) {
  const { report_type, period_start, period_end, file_format = 'pdf', title } = request;

  if (!report_type || !period_start || !period_end) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: report_type, period_start, period_end' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check permissions using DB function
  const { data: canGenerate, error: permError } = await supabase
    .rpc('can_generate_report', { p_user_id: userId, p_report_type: report_type });

  if (permError || !canGenerate?.allowed) {
    return new Response(
      JSON.stringify({ 
        error: canGenerate?.reason || 'Permission denied',
        upgrade_required: canGenerate?.upgrade_required || false
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create pending report
  const { data: reportData, error: createError } = await supabase
    .rpc('create_pending_report', {
      p_user_id: userId,
      p_report_type: report_type,
      p_title: title || `Relatório ${report_type} - ${period_start} a ${period_end}`,
      p_period_start: period_start,
      p_period_end: period_end,
      p_file_format: file_format,
      p_metadata: { requested_at: new Date().toISOString() }
    });

  if (createError || !reportData?.success) {
    console.error('[generate-report] Failed to create pending report:', createError);
    return new Response(
      JSON.stringify({ error: reportData?.reason || 'Failed to create report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const reportId = reportData.report_id;
  const filePath = reportData.file_path;

  console.log(`[generate-report] Created pending report: ${reportId}`);

  // Update status to processing
  await supabase.rpc('update_report_status', {
    p_report_id: reportId,
    p_status: 'processing'
  });

  // Generate report in background
  EdgeRuntime.waitUntil(
    generateReportAsync(supabase, userId, reportId, filePath, {
      report_type,
      period_start,
      period_end,
      file_format
    })
  );

  return new Response(
    JSON.stringify({
      success: true,
      report_id: reportId,
      status: 'processing',
      message: 'Relatório em processamento. Acompanhe o status.'
    }),
    { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generateReportAsync(
  supabase: SupabaseClientAny,
  userId: string,
  reportId: string,
  filePath: string,
  options: {
    report_type: string;
    period_start: string;
    period_end: string;
    file_format: string;
  }
) {
  try {
    console.log(`[generate-report] Starting async generation for ${reportId}`);

    // Fetch transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(`
        id, amount, currency, posted_at, description, merchant_name, category,
        bank_accounts!inner(connection_id, bank_connections!inner(user_id))
      `)
      .eq('bank_accounts.bank_connections.user_id', userId)
      .gte('posted_at', options.period_start)
      .lte('posted_at', options.period_end + 'T23:59:59Z')
      .order('posted_at', { ascending: false });

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    // Fetch analytics summary
    const { data: analytics, error: analyticsError } = await supabase
      .rpc('get_period_summary', {
        p_user_id: userId,
        p_start_date: options.period_start,
        p_end_date: options.period_end
      });

    if (analyticsError) {
      console.warn('[generate-report] Analytics error:', analyticsError);
    }

    const summary: AnalyticsSummary = analytics?.[0] || {
      total_income: 0,
      total_expenses: 0,
      net: 0,
      by_category: []
    };

    // Fetch user info
    const { data: userInfo } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    // Generate file content
    let fileContent: Uint8Array;
    let contentType: string;

    if (options.file_format === 'csv') {
      const csvContent = generateCSV(transactions || [], summary);
      fileContent = new TextEncoder().encode(csvContent);
      contentType = 'text/csv';
    } else {
      fileContent = await generatePDF(
        transactions || [],
        summary,
        {
          ...options,
          userName: userInfo?.full_name || userInfo?.email || 'Usuário',
        }
      );
      contentType = 'application/pdf';
    }

    console.log(`[generate-report] Generated ${options.file_format}, size: ${fileContent.length} bytes`);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, fileContent, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload: ${uploadError.message}`);
    }

    // Update status to ready
    await supabase.rpc('update_report_status', {
      p_report_id: reportId,
      p_status: 'ready',
      p_file_size: fileContent.length
    });

    console.log(`[generate-report] Report ${reportId} completed successfully`);

  } catch (error) {
    console.error(`[generate-report] Error generating report ${reportId}:`, error);
    
    await supabase.rpc('update_report_status', {
      p_report_id: reportId,
      p_status: 'failed',
      p_error_message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateCSV(transactions: Transaction[], summary: AnalyticsSummary): string {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const lines: string[] = [];

  // Header
  lines.push('Data,Descrição,Comerciante,Categoria,Valor,Moeda');

  // Transactions
  for (const tx of transactions) {
    const date = new Date(tx.posted_at).toLocaleDateString('pt-BR');
    const description = escapeCSV(tx.description || '');
    const merchant = escapeCSV(tx.merchant_name || '');
    const category = escapeCSV(tx.category || 'Outros');
    const amount = tx.amount.toFixed(2).replace('.', ',');
    const currency = tx.currency || 'BRL';

    lines.push(`${date},${description},${merchant},${category},${amount},${currency}`);
  }

  // Summary section
  lines.push('');
  lines.push('RESUMO');
  lines.push(`Total de Receitas,${formatCurrency(summary.total_income)}`);
  lines.push(`Total de Despesas,${formatCurrency(summary.total_expenses)}`);
  lines.push(`Saldo Líquido,${formatCurrency(summary.net)}`);

  // Category breakdown
  if (summary.by_category && summary.by_category.length > 0) {
    lines.push('');
    lines.push('GASTOS POR CATEGORIA');
    lines.push('Categoria,Valor,Percentual');
    for (const cat of summary.by_category) {
      lines.push(`${escapeCSV(cat.category)},${formatCurrency(cat.amount)},${cat.percentage}%`);
    }
  }

  return BOM + lines.join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCurrency(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

async function generatePDF(
  transactions: Transaction[],
  summary: AnalyticsSummary,
  options: {
    report_type: string;
    period_start: string;
    period_end: string;
    userName: string;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = 16;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (text: string, x: number, size: number, isBold = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: isBold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  const newPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const checkPageBreak = (neededSpace: number) => {
    if (y < margin + neededSpace) {
      newPage();
    }
  };

  // Title
  const reportTitle = getReportTitle(options.report_type);
  drawText(reportTitle, margin, 24, true);
  y -= 30;

  // Period and user info
  const periodStart = new Date(options.period_start).toLocaleDateString('pt-BR');
  const periodEnd = new Date(options.period_end).toLocaleDateString('pt-BR');
  drawText(`Período: ${periodStart} a ${periodEnd}`, margin, 12);
  y -= lineHeight;
  drawText(`Gerado para: ${options.userName}`, margin, 12);
  y -= lineHeight;
  drawText(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`, margin, 12);
  y -= 30;

  // Summary section
  drawText('RESUMO FINANCEIRO', margin, 14, true);
  y -= 25;

  const summaryItems = [
    { label: 'Total de Receitas:', value: `R$ ${formatBRL(summary.total_income)}`, color: rgb(0.1, 0.6, 0.1) },
    { label: 'Total de Despesas:', value: `R$ ${formatBRL(summary.total_expenses)}`, color: rgb(0.8, 0.1, 0.1) },
    { label: 'Saldo Líquido:', value: `R$ ${formatBRL(summary.net)}`, color: summary.net >= 0 ? rgb(0.1, 0.6, 0.1) : rgb(0.8, 0.1, 0.1) },
  ];

  for (const item of summaryItems) {
    drawText(item.label, margin, 12);
    page.drawText(item.value, {
      x: margin + 150,
      y,
      size: 12,
      font: fontBold,
      color: item.color,
    });
    y -= lineHeight + 4;
  }

  y -= 20;

  // Category breakdown
  if (summary.by_category && summary.by_category.length > 0) {
    checkPageBreak(100);
    drawText('GASTOS POR CATEGORIA', margin, 14, true);
    y -= 25;

    const colX = [margin, margin + 200, margin + 300];
    drawText('Categoria', colX[0], 10, true);
    drawText('Valor', colX[1], 10, true);
    drawText('Percentual', colX[2], 10, true);
    y -= lineHeight;

    // Draw line
    page.drawLine({
      start: { x: margin, y: y + 5 },
      end: { x: pageWidth - margin, y: y + 5 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 5;

    for (const cat of summary.by_category.slice(0, 15)) { // Top 15 categories
      checkPageBreak(lineHeight);
      drawText(truncateText(cat.category || 'Outros', 30), colX[0], 10);
      drawText(`R$ ${formatBRL(cat.amount)}`, colX[1], 10);
      drawText(`${cat.percentage?.toFixed(1) || 0}%`, colX[2], 10);
      y -= lineHeight;
    }

    y -= 20;
  }

  // Transactions list
  if (transactions.length > 0) {
    checkPageBreak(100);
    drawText('TRANSAÇÕES', margin, 14, true);
    y -= 25;

    const txColX = [margin, margin + 80, margin + 250, margin + 380];
    drawText('Data', txColX[0], 9, true);
    drawText('Descrição', txColX[1], 9, true);
    drawText('Categoria', txColX[2], 9, true);
    drawText('Valor', txColX[3], 9, true);
    y -= lineHeight;

    page.drawLine({
      start: { x: margin, y: y + 5 },
      end: { x: pageWidth - margin, y: y + 5 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 5;

    for (const tx of transactions.slice(0, 100)) { // First 100 transactions
      checkPageBreak(lineHeight);
      
      const date = new Date(tx.posted_at).toLocaleDateString('pt-BR');
      const desc = truncateText(tx.merchant_name || tx.description || '-', 25);
      const cat = truncateText(tx.category || 'Outros', 18);
      const amount = `R$ ${formatBRL(tx.amount)}`;

      drawText(date, txColX[0], 9);
      drawText(desc, txColX[1], 9);
      drawText(cat, txColX[2], 9);
      
      page.drawText(amount, {
        x: txColX[3],
        y,
        size: 9,
        font,
        color: tx.amount >= 0 ? rgb(0.1, 0.6, 0.1) : rgb(0.6, 0.1, 0.1),
      });
      
      y -= lineHeight;
    }

    if (transactions.length > 100) {
      y -= 10;
      drawText(`... e mais ${transactions.length - 100} transações`, margin, 9);
    }
  }

  // Footer on all pages
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText(`Kash - Relatório Financeiro | Página ${i + 1} de ${pages.length}`, {
      x: margin,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return pdfDoc.save();
}

function getReportTitle(type: string): string {
  const titles: Record<string, string> = {
    monthly: 'Relatório Mensal',
    annual: 'Relatório Anual',
    tax: 'Relatório para Declaração de IR',
    export: 'Exportação de Dados',
    custom: 'Relatório Personalizado',
  };
  return titles[type] || 'Relatório Financeiro';
}

function formatBRL(value: number): string {
  return Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

async function handleGetSignedUrl(
  supabase: SupabaseClientAny,
  userId: string,
  reportId: string
) {
  // Verify ownership
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .eq('user_id', userId)
    .single();

  if (error || !report) {
    return new Response(
      JSON.stringify({ error: 'Report not found or access denied' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (report.status !== 'ready') {
    return new Response(
      JSON.stringify({ error: 'Report not ready', status: report.status }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate signed URL (1 hour expiry)
  const { data: signedUrl, error: signError } = await supabase.storage
    .from('reports')
    .createSignedUrl(report.file_path, 3600);

  if (signError) {
    console.error('[generate-report] Failed to create signed URL:', signError);
    return new Response(
      JSON.stringify({ error: 'Failed to generate download URL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      download_url: signedUrl.signedUrl,
      expires_in: 3600,
      report: {
        id: report.id,
        title: report.title,
        file_format: report.file_format,
        file_size: report.file_size,
        generated_at: report.generated_at
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetStatus(
  supabase: SupabaseClientAny,
  userId: string,
  reportId: string
) {
  const { data: report, error } = await supabase
    .from('reports')
    .select('id, status, title, file_format, file_size, error_message, generated_at, finished_at')
    .eq('id', reportId)
    .eq('user_id', userId)
    .single();

  if (error || !report) {
    return new Response(
      JSON.stringify({ error: 'Report not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, report }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
