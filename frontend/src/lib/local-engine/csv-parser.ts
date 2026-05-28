import type { AccountType } from "./types";

export interface ParsedTransaction {
  date: string;
  raw_description: string;
  description: string;
  amount_cents: number;
  usaa_category: string | null;
}

function cleanDescription(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

function dollarsToCents(amountStr: string): number {
  return Math.round(parseFloat(amountStr) * 100);
}

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

export function parseUsaaCsv(
  fileContent: string,
  accountType: AccountType
): ParsedTransaction[] {
  const rows = parseCsvRows(fileContent);
  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const status = row["Status"] ?? "";
    if (status === "Pending") continue;

    const dateStr = (row["Date"] ?? "").trim();
    if (!dateStr) continue;

    let rawDescription = (row["Original Description"] ?? "").trim();
    if (!rawDescription) {
      rawDescription = (row["Description"] ?? "").trim();
    }

    const description = cleanDescription(rawDescription);
    let amountCents = dollarsToCents(row["Amount"] ?? "0");

    if (accountType === "credit") {
      amountCents = -amountCents;
    }

    let usaaCategory: string | null = (row["Category"] ?? "").trim() || null;
    if (usaaCategory === "Category Pending") {
      usaaCategory = null;
    }

    transactions.push({
      date: dateStr,
      raw_description: rawDescription,
      description,
      amount_cents: amountCents,
      usaa_category: usaaCategory,
    });
  }

  return transactions;
}
