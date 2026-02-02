import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSupportedBanks, type SupportedBank } from "@/hooks/useSupportedBanks";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";

interface AddBankModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBank: (bank: SupportedBank) => void;
}

export function AddBankModal({ open, onOpenChange, onSelectBank }: AddBankModalProps) {
  const [search, setSearch] = useState("");
  const { data: banks, isLoading } = useSupportedBanks();

  const filteredBanks = useMemo(() => {
    if (!banks) return [];
    if (!search) return banks;
    
    const searchLower = search.toLowerCase();
    return banks.filter(
      (bank) =>
        bank.display_name.toLowerCase().includes(searchLower) ||
        bank.provider_key.toLowerCase().includes(searchLower)
    );
  }, [banks, search]);

  const handleSelect = (bank: SupportedBank) => {
    onSelectBank(bank);
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar conta bancária</DialogTitle>
        </DialogHeader>

        <Command className="rounded-lg border shadow-md">
          <CommandInput
            placeholder="Buscar banco..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
            
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <CommandGroup heading="Bancos disponíveis">
                <AnimatePresence>
                  {filteredBanks.map((bank, index) => (
                    <motion.div
                      key={bank.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <CommandItem
                        value={bank.display_name}
                        onSelect={() => handleSelect(bank)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                          {bank.logo_url ? (
                            <img
                              src={bank.logo_url}
                              alt={bank.display_name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{bank.display_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {bank.provider_key}
                          </p>
                        </div>
                      </CommandItem>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
