import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FileText, FileSpreadsheet, Sparkles, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useGenerateReport, type ReportType, type ReportFormat } from "@/hooks/useReports";
import { useSubscription } from "@/hooks/useSubscription";

interface GenerateReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const reportTypes: Array<{
  value: ReportType;
  label: string;
  description: string;
  premiumOnly: boolean;
}> = [
  {
    value: "monthly",
    label: "Relatório Mensal",
    description: "Resumo completo do mês com transações e categorias",
    premiumOnly: false,
  },
  {
    value: "annual",
    label: "Relatório Anual",
    description: "Visão consolidada do ano com tendências e comparativos",
    premiumOnly: false,
  },
  {
    value: "tax",
    label: "Relatório Fiscal",
    description: "Preparado para declaração de imposto de renda",
    premiumOnly: true,
  },
  {
    value: "export",
    label: "Exportação de Dados",
    description: "Todas as transações em formato de planilha",
    premiumOnly: false,
  },
];

const quickPeriods = [
  { label: "Mês atual", getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: "Mês passado", getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Últimos 3 meses", getValue: () => ({ start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date()) }) },
  { label: "Este ano", getValue: () => ({ start: startOfYear(new Date()), end: endOfYear(new Date()) }) },
];

export function GenerateReportModal({ open, onOpenChange }: GenerateReportModalProps) {
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [fileFormat, setFileFormat] = useState<ReportFormat>("pdf");
  const [periodStart, setPeriodStart] = useState<Date>(startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date>(endOfMonth(new Date()));
  const [title, setTitle] = useState("");

  const { data: subscription } = useSubscription();
  const { mutate: generateReport, isPending } = useGenerateReport();

  const selectedType = reportTypes.find((t) => t.value === reportType);
  const isPremiumRequired = selectedType?.premiumOnly && !subscription?.is_premium;

  const handleQuickPeriod = (getValue: () => { start: Date; end: Date }) => {
    const { start, end } = getValue();
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const handleGenerate = () => {
    generateReport(
      {
        report_type: reportType,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        file_format: fileFormat,
        title: title || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          // Reset form
          setReportType("monthly");
          setFileFormat("pdf");
          setPeriodStart(startOfMonth(new Date()));
          setPeriodEnd(endOfMonth(new Date()));
          setTitle("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Relatório
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo de relatório e o período desejado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Report Type */}
          <div className="space-y-2">
            <Label>Tipo de Relatório</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <span>{type.label}</span>
                      {type.premiumOnly && (
                        <Crown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <p className="text-sm text-muted-foreground">
                {selectedType.description}
              </p>
            )}
            {isPremiumRequired && (
              <div className="rounded-lg border border-accent bg-accent/10 p-3">
                <p className="text-sm text-accent-foreground">
                  Este tipo de relatório requer o plano Pro.{" "}
                  <Button variant="link" className="h-auto p-0 text-primary">
                    Fazer upgrade
                  </Button>
                </p>
              </div>
            )}
          </div>

          {/* File Format */}
          <div className="space-y-2">
            <Label>Formato</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={fileFormat === "pdf" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFileFormat("pdf")}
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button
                type="button"
                variant={fileFormat === "csv" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFileFormat("csv")}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>

          {/* Quick Period Selection */}
          <div className="space-y-2">
            <Label>Período Rápido</Label>
            <div className="flex flex-wrap gap-2">
              {quickPeriods.map((period) => (
                <Badge
                  key={period.label}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => handleQuickPeriod(period.getValue)}
                >
                  {period.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Custom Period */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !periodStart && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {periodStart ? (
                      format(periodStart, "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecione</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodStart}
                    onSelect={(date) => date && setPeriodStart(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !periodEnd && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {periodEnd ? (
                      format(periodEnd, "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecione</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodEnd}
                    onSelect={(date) => date && setPeriodEnd(date)}
                    disabled={(date) => date < periodStart}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Custom Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título (opcional)</Label>
            <Input
              id="title"
              placeholder="Ex: Relatório Q1 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isPending || isPremiumRequired}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Relatório
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
