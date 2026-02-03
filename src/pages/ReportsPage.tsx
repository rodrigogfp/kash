import { useState } from "react";
import { FileText, Plus, FileQuestion, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportRow, GenerateReportModal } from "@/components/reports";
import { useReports } from "@/hooks/useReports";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";

export default function ReportsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: reports, isLoading, error } = useReports({
    reportType: typeFilter === "all" ? undefined : typeFilter,
  });
  const { data: subscription } = useSubscription();

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">
            Gere e baixe relatórios financeiros em PDF ou CSV
          </p>
        </div>
        <div className="flex items-center gap-3">
          {subscription && (
            <Badge variant={subscription.is_premium ? "default" : "secondary"} className="gap-1">
              {subscription.is_premium && <Crown className="h-3 w-3" />}
              Plano {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
            </Badge>
          )}
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Relatório
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Meus Relatórios
            </CardTitle>
            <CardDescription>
              Histórico de relatórios gerados com status em tempo real
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
                <SelectItem value="tax">Fiscal</SelectItem>
                <SelectItem value="export">Exportação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Erro ao carregar relatórios</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error instanceof Error ? error.message : "Tente novamente mais tarde"}
              </p>
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Relatório</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <ReportRow key={report.id} report={report} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum relatório ainda</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Gere seu primeiro relatório para visualizar o histórico de suas finanças
              </p>
              <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar Primeiro Relatório
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Report Modal */}
      <GenerateReportModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
