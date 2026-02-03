import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Report } from "@/hooks/useReports";
import { useReportDownload, useDeleteReport } from "@/hooks/useReports";

interface ReportRowProps {
  report: Report;
}

const reportTypeLabels: Record<string, string> = {
  monthly: "Mensal",
  annual: "Anual",
  tax: "Fiscal",
  export: "Exportação",
};

const formatLabels: Record<string, string> = {
  pdf: "PDF",
  csv: "CSV",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReportRow({ report }: ReportRowProps) {
  const { mutate: downloadReport, isPending: isDownloading } = useReportDownload();
  const { mutate: deleteReport, isPending: isDeleting } = useDeleteReport();

  const isPdf = report.file_format === "pdf";
  const FileIcon = isPdf ? FileText : FileSpreadsheet;

  const getStatusBadge = () => {
    switch (report.status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Aguardando
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processando
          </Badge>
        );
      case "ready":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Pronto
          </Badge>
        );
      case "failed":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="gap-1 cursor-help">
                <AlertCircle className="h-3 w-3" />
                Erro
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{report.error_message || "Erro desconhecido"}</p>
            </TooltipContent>
          </Tooltip>
        );
      default:
        return <Badge variant="outline">{report.status}</Badge>;
    }
  };

  const periodLabel = `${format(new Date(report.period_start), "dd/MM/yy", { locale: ptBR })} - ${format(new Date(report.period_end), "dd/MM/yy", { locale: ptBR })}`;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{report.title}</span>
            <span className="text-sm text-muted-foreground">{periodLabel}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{reportTypeLabels[report.report_type] || report.report_type}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{formatLabels[report.file_format] || report.file_format}</Badge>
      </TableCell>
      <TableCell>{getStatusBadge()}</TableCell>
      <TableCell className="text-muted-foreground">
        {format(new Date(report.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatFileSize(report.file_size)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={report.status !== "ready" || isDownloading}
            onClick={() => downloadReport(report.id)}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Download</span>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O relatório "{report.title}" será permanentemente removido.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteReport(report.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
