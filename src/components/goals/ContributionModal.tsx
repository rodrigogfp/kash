import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Goal } from "@/hooks/useGoals";

const contributionSchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  note: z.string().max(200).optional(),
});

type ContributionFormValues = z.infer<typeof contributionSchema>;

interface ContributionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { amount: number; note?: string }) => void;
  goal: Goal | null;
  isLoading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function ContributionModal({ 
  open, 
  onOpenChange, 
  onSubmit, 
  goal,
  isLoading 
}: ContributionModalProps) {
  const form = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      amount: 0,
      note: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ amount: 0, note: "" });
    }
  }, [open, form]);

  const handleSubmit = (values: ContributionFormValues) => {
    onSubmit({
      amount: values.amount,
      note: values.note || undefined,
    });
  };

  if (!goal) return null;

  const remaining = goal.target_amount - goal.current_amount;
  const progressPercent = goal.target_amount > 0 
    ? ((goal.current_amount / goal.target_amount) * 100).toFixed(0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <PlusCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <DialogTitle>Adicionar Contribuição</DialogTitle>
              <DialogDescription>
                {goal.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Current progress */}
        <div className="p-4 rounded-xl bg-muted/50 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso atual</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">{formatCurrency(goal.current_amount)}</span>
            <span className="text-muted-foreground">de {formatCurrency(goal.target_amount)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Faltam {formatCurrency(remaining)} para atingir sua meta
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor da contribuição</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        R$
                      </span>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="100,00" 
                        className="input-glass pl-10"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Ex: Bônus do trabalho" 
                      className="input-glass resize-none"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Adicione uma descrição para essa contribuição
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quick amount buttons */}
            <div className="flex gap-2">
              {[100, 500, 1000].map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => form.setValue("amount", amount)}
                >
                  R$ {amount}
                </Button>
              ))}
              {remaining > 0 && remaining <= 10000 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => form.setValue("amount", remaining)}
                >
                  Completar
                </Button>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? "Salvando..." : "Contribuir"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
