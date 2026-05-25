"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface InfoTipProps {
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-wrap leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
