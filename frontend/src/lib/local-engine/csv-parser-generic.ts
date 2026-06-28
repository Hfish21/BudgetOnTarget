import type { AccountType } from "./types";
import type { ParsedTransaction } from "./csv-parser";
import { parseCsvRows, cleanDescription, dollarsToCents } from "./csv-parser";

export interface ColumnMapping {
  dateColumn: string | null;
  descriptionColumn: string | null;
  amountColumn: string | null;
  debitColumn: string | null;
  creditColumn: string | null;
  categoryColumn: string | null;
}

export interface FieldMappingConfig {
  mapping: ColumnMapping;
  amountMode: "single" | "split";
  signConvention: "negative_expense" | "positive_expense";
  dateFormat: "auto" | "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
}

const DATE_PATTERNS = [
  "date",
  "transaction date",
  "posted date",
  "posting date",
  "trans date",
  "post date",
];
const DESC_PATTERNS = [
  "description",
  "original description",
  "memo",
  "transaction description",
  "merchant",
  "name",
  "payee",
  "merchant name",
];
const AMOUNT_PATTERNS = ["amount", "transaction amount"];
const DEBIT_PATTERNS = ["debit", "withdrawal", "debit amount"];
const CREDIT_PATTERNS = ["credit", "deposit", "credit amount"];
const CATEGORY_PATTERNS = ["category", "type"];

function matchHeader(
  headers: string[],
  patterns: string[]
): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const pattern of patterns) {
    const idx = lower.indexOf(pattern);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const dateColumn = matchHeader(headers, DATE_PATTERNS);
  const descriptionColumn = matchHeader(headers, DESC_PATTERNS);
  const amountColumn = matchHeader(headers, AMOUNT_PATTERNS);
  const debitColumn = matchHeader(headers, DEBIT_PATTERNS);
  const creditColumn = matchHeader(headers, CREDIT_PATTERNS);
  const categoryColumn = matchHeader(headers, CATEGORY_PATTERNS);

  return {
    dateColumn,
    descriptionColumn,
    amountColumn,
    debitColumn,
    creditColumn,
    categoryColumn,
  };
}

export function inferAmountMode(
  mapping: ColumnMapping
): "single" | "split" {
  if (mapping.amountColumn) return "single";
  if (mapping.debitColumn || mapping.creditColumn) return "split";
  return "single";
}

export function detectDateFormat(
  samples: string[]
): FieldMappingConfig["dateFormat"] {
  for (const s of samples) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "YYYY-MM-DD";

    const slashMatch = trimmed.match(
      /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/
    );
    if (slashMatch) {
      const first = parseInt(slashMatch[1], 10);
      const second = parseInt(slashMatch[2], 10);
      if (second > 12) return "MM/DD/YYYY";
      if (first > 12) return "DD/MM/YYYY";
    }
  }
  return "MM/DD/YYYY";
}

export function detectSignConvention(
  amounts: number[]
): FieldMappingConfig["signConvention"] {
  const nonZero = amounts.filter((a) => a !== 0);
  if (nonZero.length === 0) return "negative_expense";
  const negCount = nonZero.filter((a) => a < 0).length;
  return negCount > nonZero.length / 2
    ? "negative_expense"
    : "positive_expense";
}

function parseDateToISO(
  dateStr: string,
  format: FieldMappingConfig["dateFormat"]
): string {
  const trimmed = dateStr.trim();

  if (format === "YYYY-MM-DD") return trimmed;

  const parts = trimmed.split(/[/\-.]/);
  if (parts.length < 3) return trimmed;

  let month: string, day: string, year: string;

  if (format === "DD/MM/YYYY") {
    [day, month, year] = parts;
  } else {
    [month, day, year] = parts;
  }

  if (format === "auto") {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    if (m > 12) {
      day = parts[0];
      month = parts[1];
    } else {
      month = parts[0];
      day = parts[1];
    }
    year = parts[2];
  }

  const fullYear =
    year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseGenericCsv(
  fileContent: string,
  config: FieldMappingConfig,
  accountType: AccountType
): ParsedTransaction[] {
  const rows = parseCsvRows(fileContent);
  const { mapping, amountMode, signConvention } = config;
  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const dateStr = mapping.dateColumn ? (row[mapping.dateColumn] ?? "").trim() : "";
    if (!dateStr) continue;

    const rawDescription = mapping.descriptionColumn
      ? (row[mapping.descriptionColumn] ?? "").trim()
      : "";
    const description = cleanDescription(rawDescription);

    let amountCents: number;
    if (amountMode === "split") {
      const debitStr = mapping.debitColumn ? (row[mapping.debitColumn] ?? "").trim() : "";
      const creditStr = mapping.creditColumn ? (row[mapping.creditColumn] ?? "").trim() : "";
      const debit = debitStr ? Math.abs(dollarsToCents(debitStr)) : 0;
      const credit = creditStr ? Math.abs(dollarsToCents(creditStr)) : 0;
      amountCents = credit - debit;
    } else {
      amountCents = dollarsToCents(
        mapping.amountColumn ? (row[mapping.amountColumn] ?? "0") : "0"
      );
    }

    if (signConvention === "positive_expense" && amountMode === "single") {
      amountCents = -amountCents;
    }

    if (accountType === "credit") {
      amountCents = -amountCents;
    }

    const date = parseDateToISO(dateStr, config.dateFormat);

    const sourceCategory = mapping.categoryColumn
      ? (row[mapping.categoryColumn] ?? "").trim() || null
      : null;

    transactions.push({
      date,
      raw_description: rawDescription,
      description,
      amount_cents: amountCents,
      usaa_category: sourceCategory,
      is_pending: false,
    });
  }

  return transactions;
}

export function autoDetectConfig(
  fileContent: string,
  accountType: AccountType
): { headers: string[]; sampleRows: Record<string, string>[]; config: FieldMappingConfig } {
  const rows = parseCsvRows(fileContent);
  const headers =
    rows.length > 0 ? Object.keys(rows[0]) : [];
  const sampleRows = rows.slice(0, 5);
  const mapping = detectColumnMapping(headers);
  const amountMode = inferAmountMode(mapping);

  const dateSamples = mapping.dateColumn
    ? sampleRows.map((r) => r[mapping.dateColumn!] ?? "")
    : [];
  const dateFormat = detectDateFormat(dateSamples);

  let signConvention: FieldMappingConfig["signConvention"] = "negative_expense";
  if (amountMode === "single" && mapping.amountColumn) {
    const amountSamples = sampleRows
      .map((r) => dollarsToCents(r[mapping.amountColumn!] ?? "0"))
      .filter((a) => a !== 0);
    signConvention = detectSignConvention(amountSamples);
  }

  return {
    headers,
    sampleRows,
    config: { mapping, amountMode, signConvention, dateFormat },
  };
}
