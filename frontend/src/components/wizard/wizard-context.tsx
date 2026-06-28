"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { AccountType, SpendGroup, Direction } from "@/lib/local-engine/types";
import type { FieldMappingConfig } from "@/lib/local-engine/csv-parser-generic";
import type { ImportResult } from "@/lib/local-engine/importer";

export interface WizardCsvFile {
  id: string;
  file: File;
  rawContent: string;
  headers: string[];
  sampleRows: Record<string, string>[];
  mapping: FieldMappingConfig;
  account: {
    name: string;
    institution: string;
    type: AccountType;
  } | null;
  imported: boolean;
  importResult: ImportResult | null;
}

export interface WizardTargetDraft {
  categoryId: number;
  categoryName: string;
  spendGroup: SpendGroup;
  suggestedAmountCents: number;
  userAmountCents: number;
  direction: Direction;
  enabled: boolean;
}

export const WIZARD_STEPS = [
  "Upload",
  "Categories",
  "Targets",
  "Review",
  "Done",
] as const;

interface WizardContextValue {
  currentStep: number;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (n: number) => void;
  csvFiles: WizardCsvFile[];
  addCsvFile: (file: WizardCsvFile) => void;
  updateCsvFile: (id: string, updates: Partial<WizardCsvFile>) => void;
  removeCsvFile: (id: string) => void;
  targetDrafts: WizardTargetDraft[];
  setTargetDrafts: (drafts: WizardTargetDraft[]) => void;
  updateTargetDraft: (categoryId: number, updates: Partial<WizardTargetDraft>) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [csvFiles, setCsvFiles] = useState<WizardCsvFile[]>([]);
  const [targetDrafts, setTargetDrafts] = useState<WizardTargetDraft[]>([]);

  const nextStep = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const setStep = useCallback((n: number) => {
    setCurrentStep(Math.max(0, Math.min(n, WIZARD_STEPS.length - 1)));
  }, []);

  const addCsvFile = useCallback((file: WizardCsvFile) => {
    setCsvFiles((prev) => [...prev, file]);
  }, []);

  const updateCsvFile = useCallback(
    (id: string, updates: Partial<WizardCsvFile>) => {
      setCsvFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    []
  );

  const removeCsvFile = useCallback((id: string) => {
    setCsvFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const updateTargetDraft = useCallback(
    (categoryId: number, updates: Partial<WizardTargetDraft>) => {
      setTargetDrafts((prev) =>
        prev.map((d) => (d.categoryId === categoryId ? { ...d, ...updates } : d))
      );
    },
    []
  );

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        nextStep,
        prevStep,
        setStep,
        csvFiles,
        addCsvFile,
        updateCsvFile,
        removeCsvFile,
        targetDrafts,
        setTargetDrafts,
        updateTargetDraft,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}
