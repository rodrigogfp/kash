import React, { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Wallet, PieChart, MessageCircle, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "sonner";

interface SlideProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
}

const slides: SlideProps[] = [
  {
    icon: <Wallet className="w-16 h-16" />,
    title: "Conecte suas contas",
    description:
      "Agregue todas as suas contas bancárias em um só lugar via Open Finance. Seguro, criptografado e você no controle.",
    accentColor: "from-primary to-accent",
  },
  {
    icon: <PieChart className="w-16 h-16" />,
    title: "Visualize seus gastos",
    description:
      "Gráficos inteligentes e categorização automática mostram para onde vai seu dinheiro. Compare períodos e identifique padrões.",
    accentColor: "from-success to-primary",
  },
  {
    icon: <MessageCircle className="w-16 h-16" />,
    title: "Converse com a IA",
    description:
      'Pergunte qualquer coisa sobre suas finanças. "Quanto gastei em restaurantes?" A IA responde com dados reais.',
    accentColor: "from-accent to-primary",
  },
];

function Slide({ icon, title, description, accentColor }: SlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center text-center space-y-6 px-6"
    >
      <div
        className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${accentColor} flex items-center justify-center text-white shadow-lg`}
      >
        {icon}
      </div>
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <p className="text-muted-foreground max-w-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

export function OnboardingFlow() {
  const navigate = useNavigate();
  const {
    currentStep,
    totalSteps,
    isUpdating,
    nextStep,
    prevStep,
    completeOnboarding,
    skipOnboarding,
  } = useOnboarding();

  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = async () => {
    if (isLastStep) {
      const { error } = await completeOnboarding();
      if (error) {
        toast.error("Erro ao completar onboarding");
        return;
      }
      navigate("/");
    } else {
      await nextStep();
    }
  };

  const handlePrev = async () => {
    await prevStep();
  };

  const handleSkip = async () => {
    const { error } = await skipOnboarding();
    if (error) {
      toast.error("Erro ao pular onboarding");
      return;
    }
    navigate("/");
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isUpdating) return;

      switch (e.key) {
        case "ArrowRight":
        case "Enter":
          handleNext();
          break;
        case "ArrowLeft":
          if (!isFirstStep) handlePrev();
          break;
        case "Escape":
          handleSkip();
          break;
      }
    },
    [currentStep, isUpdating, isFirstStep]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "-3s" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="text-2xl font-bold text-gradient">Kash</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={isUpdating}
          className="text-muted-foreground"
        >
          Pular
          <X className="w-4 h-4 ml-1" />
        </Button>
      </header>

      {/* Progress */}
      <div className="relative z-10 px-6">
        <Progress value={progress} className="h-1" />
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Passo {currentStep + 1} de {totalSteps}</span>
          <span className="text-xs opacity-50">← → para navegar, Esc para pular</span>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <Slide key={currentStep} {...slides[currentStep]} />
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <footer className="relative z-10 px-6 py-8">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrev}
            disabled={isFirstStep || isUpdating}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </Button>

          {/* Dots */}
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? "w-6 bg-primary"
                    : index < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          <Button
            size="lg"
            onClick={handleNext}
            disabled={isUpdating}
            className="gap-2"
          >
            {isLastStep ? (
              <>
                <Landmark className="w-4 h-4" />
                Adicionar Banco
              </>
            ) : (
              <>
                Próximo
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}