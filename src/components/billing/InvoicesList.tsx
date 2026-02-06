import { Receipt, ExternalLink, Loader2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Invoice {
  id: string;
  description: string | null;
  created_at: string;
  status: string;
  amount_cents: number;
  pdf_url: string | null;
  hosted_invoice_url: string | null;
}

interface InvoicesListProps {
  invoices: Invoice[] | undefined;
  isLoading: boolean;
}

export function InvoicesList({ invoices, isLoading }: InvoicesListProps) {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default">Pago</Badge>;
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <p className="font-medium">{invoice.description || "Assinatura Kash"}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(invoice.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {getStatusBadge(invoice.status)}
              <span className="font-medium min-w-[80px] text-right">
                {formatPrice(invoice.amount_cents)}
              </span>
              <div className="flex gap-1">
                {invoice.pdf_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a 
                      href={invoice.pdf_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      title="Baixar PDF"
                    >
                      <Receipt className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {invoice.hosted_invoice_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a 
                      href={invoice.hosted_invoice_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      title="Ver no Stripe"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
