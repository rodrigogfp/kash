import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Target } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { cn } from "@/lib/utils";
import type { Goal, GoalInsert } from "@/hooks/useGoals";

const goalFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  target_amount: z.coerce.number().positive("Valor deve ser positivo"),
  current_amount: z.coerce.number().min(0).optional(),
  deadline: z.date().optional(),
  category: z.string().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

interface NewGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GoalInsert) => void;
  userId: string;
  editGoal?: Goal | null;
  isLoading?: boolean;
}

const GOAL_CATEGORIES = [
  "Emergência",
  "Viagem",
  "Educação",
  "Casa",
  "Carro",
  "Aposentadoria",
  "Investimento",
  "Outro",
];

export function NewGoalModal({ 
  open, 
  onOpenChange, 
  onSubmit, 
  userId,
  editGoal,
  isLoading 
}: NewGoalModalProps) {
  const isEditing = !!editGoal;
  
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: editGoal ? {
      name: editGoal.name,
      target_amount: editGoal.target_amount,
      current_amount: editGoal.current_amount,
      deadline: editGoal.deadline ? new Date(editGoal.deadline) : undefined,
      category: editGoal.category || undefined,
    } : {
      name: "",
      target_amount: 0,
      current_amount: 0,
    },
  });

  // Reset form when editGoal changes
  React.useEffect(() => {
    if (editGoal) {
      form.reset({
        name: editGoal.name,
        target_amount: editGoal.target_amount,
        current_amount: editGoal.current_amount,
        deadline: editGoal.deadline ? new Date(editGoal.deadline) : undefined,
        category: editGoal.category || undefined,
      });
    } else {
      form.reset({
        name: "",
        target_amount: 0,
        current_amount: 0,
      });
    }
  }, [editGoal, form]);

  const handleSubmit = (values: GoalFormValues) => {
    onSubmit({
      user_id: userId,
      name: values.name,
      target_amount: values.target_amount,
      current_amount: values.current_amount || 0,
      deadline: values.deadline ? format(values.deadline, "yyyy-MM-dd") : null,
      category: values.category || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>
                {isEditing ? "Editar Meta" : "Nova Meta"}
              </DialogTitle>
              <DialogDescription>
                {isEditing 
                  ? "Atualize os detalhes da sua meta" 
                  : "Defina uma meta financeira para acompanhar"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da meta</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Viagem para Europa" 
                      className="input-glass"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor alvo</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        R$
                      </span>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="10.000,00" 
                        className="input-glass pl-10"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <FormField
                control={form.control}
                name="current_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor inicial (opcional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          R$
                        </span>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00" 
                          className="input-glass pl-10"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Quanto você já tem guardado para essa meta
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Prazo (opcional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal input-glass",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-glass">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GOAL_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isLoading ? "Salvando..." : isEditing ? "Salvar" : "Criar meta"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
