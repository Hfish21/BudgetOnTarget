"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

/** A small hoverable info icon that explains the number or term next to it. */
export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={100}>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex translate-y-px items-center text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label="More information"
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
