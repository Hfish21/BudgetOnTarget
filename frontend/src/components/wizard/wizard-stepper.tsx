import { Check } from "lucide-react";
import { WIZARD_STEPS } from "./wizard-context";
import { cn } from "@/lib/utils";

interface WizardStepperProps {
  currentStep: number;
}

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {WIZARD_STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                i < currentStep &&
                  "border-green-500 bg-green-500 text-white",
                i === currentStep &&
                  "border-primary bg-primary text-primary-foreground",
                i > currentStep &&
                  "border-muted-foreground/30 text-muted-foreground/50"
              )}
            >
              {i < currentStep ? <Check className="size-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                i <= currentStep
                  ? "text-foreground"
                  : "text-muted-foreground/50"
              )}
            >
              {label}
            </span>
          </div>
          {i < WIZARD_STEPS.length - 1 && (
            <div
              className={cn(
                "mx-3 mb-5 h-0.5 w-12",
                i < currentStep ? "bg-green-500" : "bg-muted-foreground/20"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
