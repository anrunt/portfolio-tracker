"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setDisplayCurrency,
} from "@/server/actions/dashboard-actions";
import type { DisplayCurrency } from "@/server/actions/types";
import { cn } from "@/lib/utils";

interface Props {
  displayCurrency: DisplayCurrency;
}

const CURRENCIES: DisplayCurrency[] = ["USD", "PLN"];

export default function DisplayCurrencyToggle({ displayCurrency }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    if (next === displayCurrency) return;
    startTransition(async () => {
      await setDisplayCurrency(next as DisplayCurrency);
    });
  }

  return (
    <Select
      value={displayCurrency}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger
        size="sm"
        aria-label="Display currency"
        className={cn(
          "h-7 gap-1.5 rounded border border-border bg-background px-2.5 py-0",
          "font-(family-name:--font-jb-mono) text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground",
          "shadow-none transition-all duration-150 cursor-pointer",
          "hover:border-primary/40 hover:bg-background hover:text-foreground",
          "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary/60",
          "data-[state=open]:border-primary/60 data-[state=open]:text-foreground data-[state=open]:bg-background",
          "dark:bg-background dark:hover:bg-background",
          "[&>svg]:size-3 [&>svg]:opacity-60",
          isPending && "opacity-60 cursor-wait"
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[8px] text-muted-foreground/60 tracking-[0.2em]">
            DISPLAY
          </span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        className={cn(
          "min-w-24 rounded border border-border/70 bg-background p-1",
          "font-(family-name:--font-jb-mono)"
        )}
      >
        {CURRENCIES.map((c) => (
          <SelectItem
            key={c}
            value={c}
            className={cn(
              "rounded-sm py-1.5 pl-2 pr-7 text-[10px] uppercase tracking-[0.18em] cursor-pointer",
              "focus:bg-primary/10 focus:text-foreground",
              "data-[state=checked]:text-primary"
            )}
          >
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
