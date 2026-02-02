import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import type { PeriodType } from "@/hooks/useAnalytics";

interface PeriodSelectorProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  compare: boolean;
  onCompareChange: (compare: boolean) => void;
}

export function PeriodSelector({
  period,
  onPeriodChange,
  compare,
  onCompareChange,
}: PeriodSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <ToggleGroup
        type="single"
        value={period}
        onValueChange={(value) => value && onPeriodChange(value as PeriodType)}
        className="glass rounded-xl p-1"
      >
        <ToggleGroupItem
          value="week"
          aria-label="Week view"
          className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-4"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Week</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="month"
          aria-label="Month view"
          className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-4"
        >
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">Month</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="year"
          aria-label="Year view"
          className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-4"
        >
          <CalendarRange className="h-4 w-4" />
          <span className="hidden sm:inline">Year</span>
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="flex items-center gap-2">
        <Switch
          id="compare-toggle"
          checked={compare}
          onCheckedChange={onCompareChange}
        />
        <Label
          htmlFor="compare-toggle"
          className="text-sm text-muted-foreground cursor-pointer"
        >
          Compare with previous
        </Label>
      </div>
    </div>
  );
}
