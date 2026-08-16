"use client";

import { useWizard } from "./wizard-context";
import { WizardStepper } from "./wizard-stepper";
import { CsvUploadStep } from "./steps/csv-upload-step";
import { CategoryReviewStep } from "./steps/category-review-step";
import { TargetSetupStep } from "./steps/target-setup-step";
import { SummaryStep } from "./steps/summary-step";
import { CompleteStep } from "./steps/complete-step";

const STEP_COMPONENTS = [
  CsvUploadStep,
  CategoryReviewStep,
  TargetSetupStep,
  SummaryStep,
  CompleteStep,
];

export function SetupWizard() {
  const { currentStep } = useWizard();

  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="size-6" />
            <span className="text-sm font-semibold">BudgetOnTarget</span>
          </div>
          <WizardStepper currentStep={currentStep} />
          <div className="hidden w-[120px] sm:block" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <StepComponent />
        </div>
      </main>
    </div>
  );
}
