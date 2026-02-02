import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AddBankModal, BankLinkFlow, ConnectionStatus } from "@/components/bank";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useAuth } from "@/contexts/AuthContext";
import type { SupportedBank } from "@/hooks/useSupportedBanks";
import { Plus, Building2, Wallet, TrendingUp, ArrowRight } from "lucide-react";

export default function AccountsPage() {
  const { user } = useAuth();
  const { data: connections, isLoading } = useBankConnections(user?.id);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<SupportedBank | null>(null);
  const [isLinkFlowOpen, setIsLinkFlowOpen] = useState(false);

  const handleSelectBank = (bank: SupportedBank) => {
    setSelectedBank(bank);
    setIsLinkFlowOpen(true);
  };

  const handleLinkComplete = () => {
    setSelectedBank(null);
    setIsLinkFlowOpen(false);
  };

  const totalBalance = connections?.reduce((sum, conn) => {
    const connBalance = conn.bank_accounts?.reduce(
      (accSum, acc) => accSum + (acc.current_balance || 0),
      0
    ) || 0;
    return sum + connBalance;
  }, 0) || 0;

  const totalAccounts = connections?.reduce(
    (sum, conn) => sum + (conn.bank_accounts?.length || 0),
    0
  ) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">Suas Contas</h1>
        <p className="text-muted-foreground">
          Gerencie suas conexões bancárias e visualize seus saldos
        </p>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
      >
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Patrimônio total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bancos conectados</p>
                <p className="text-2xl font-bold">{connections?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contas ativas</p>
                <p className="text-2xl font-bold">{totalAccounts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Account Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <Button
          onClick={() => setIsAddModalOpen(true)}
          size="lg"
          className="w-full sm:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          Adicionar conta
        </Button>
      </motion.div>

      {/* Connections List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : connections && connections.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence>
              {connections.map((connection) => (
                <ConnectionStatus
                  key={connection.id}
                  connection={connection}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma conta conectada
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Conecte suas contas bancárias para visualizar seus saldos e
                transações em um só lugar.
              </p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                Conectar primeiro banco
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Modals */}
      <AddBankModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSelectBank={handleSelectBank}
      />

      <BankLinkFlow
        bank={selectedBank}
        open={isLinkFlowOpen}
        onOpenChange={setIsLinkFlowOpen}
        onComplete={handleLinkComplete}
      />
    </div>
  );
}
