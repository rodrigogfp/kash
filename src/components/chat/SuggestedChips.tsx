import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

interface QuickChip {
  id: string;
  text: string;
  category: string;
}

interface SuggestedChipsProps {
  chips: QuickChip[];
  onSelect: (text: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function SuggestedChips({ chips, onSelect, isLoading, disabled }: SuggestedChipsProps) {
  if (isLoading || chips.length === 0) return null;

  return (
    <div className="pb-2">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Sparkles className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Sugestões rápidas</span>
      </div>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {chips.map((chip) => (
            <Button
              key={chip.id}
              variant="outline"
              size="sm"
              className="flex-shrink-0 text-xs h-8 rounded-full"
              onClick={() => onSelect(chip.text)}
              disabled={disabled}
            >
              {chip.text}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
