import type { BudgetStore } from "./store";
import type { AccountType, BudgetTransaction } from "./types";
import { categorize } from "./categorizer";
import { parseUsaaCsv } from "./csv-parser";
import { computeFileHash, computeTransactionHash } from "./hasher";

const INTERNAL_TRANSFER_PATTERNS = [
  /USAA CREDIT CARD PAYMENT/i,
  /USAA FUNDS TRANSFER/i,
  /USAA TRANSFER/i,
  /ZELLE.*(?:HAYDEN|JORDYN)/i,
  /(?:HAYDEN|JORDYN).*ZELLE/i,
];

function isInternalTransfer(description: string): boolean {
  return INTERNAL_TRANSFER_PATTERNS.some((p) => p.test(description));
}

export interface ImportResult {
  csv_import_id: number;
  filename: string;
  total_rows: number;
  new_transactions: number;
  duplicate_transactions: number;
  categorized_count: number;
  uncategorized_count: number;
  errors: string[];
}

export async function importCsv(
  store: BudgetStore,
  fileContent: ArrayBuffer,
  filename: string,
  accountId: number
): Promise<ImportResult> {
  const fileHash = await computeFileHash(fileContent);

  if (store.hasFileHash(fileHash)) {
    const existing = store.csvImports.find((i) => i.file_hash === fileHash)!;
    return {
      csv_import_id: existing.id,
      filename,
      total_rows: 0,
      new_transactions: 0,
      duplicate_transactions: 0,
      categorized_count: 0,
      uncategorized_count: 0,
      errors: ["DUPLICATE_FILE"],
    };
  }

  const account = store.accountById(accountId);
  if (!account) throw new Error(`Account with id ${accountId} not found`);

  const text = new TextDecoder("utf-8").decode(fileContent);
  const cleanText = text.startsWith("﻿") ? text.slice(1) : text;
  const parsed = parseUsaaCsv(cleanText, account.account_type as AccountType);

  if (parsed.length === 0) {
    const imp = store.addCsvImport({
      filename,
      file_hash: fileHash,
      row_count: 0,
      new_transaction_count: 0,
      account_id: accountId,
    });
    return {
      csv_import_id: imp.id,
      filename,
      total_rows: 0,
      new_transactions: 0,
      duplicate_transactions: 0,
      categorized_count: 0,
      uncategorized_count: 0,
      errors: [],
    };
  }

  // Compute hashes
  const hashEntries: { hash: string; index: number }[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const pt = parsed[i];
    const hash = await computeTransactionHash(
      pt.date,
      pt.amount_cents,
      pt.raw_description,
      accountId
    );
    hashEntries.push({ hash, index: i });
  }

  const existingHashes = store.existingTransactionHashes(
    hashEntries.map((e) => e.hash)
  );

  const csvImport = store.addCsvImport({
    filename,
    file_hash: fileHash,
    row_count: parsed.length,
    new_transaction_count: 0,
    account_id: accountId,
  });

  const memberId =
    account.owner_type === "personal" && account.household_member_id != null
      ? account.household_member_id
      : null;

  const newTxns: Omit<BudgetTransaction, "id" | "created_at">[] = [];
  let categorizedCount = 0;
  let duplicateCount = 0;

  for (const { hash, index } of hashEntries) {
    if (existingHashes.has(hash)) {
      duplicateCount++;
      continue;
    }

    const pt = parsed[index];
    const categoryId = categorize(pt.description, store.categoryRules);
    const transfer = isInternalTransfer(pt.description);

    if (categoryId != null) categorizedCount++;

    newTxns.push({
      external_hash: hash,
      date: pt.date,
      description: pt.description,
      raw_description: pt.raw_description,
      amount_cents: pt.amount_cents,
      account_id: accountId,
      household_member_id: memberId,
      category_id: categoryId,
      usaa_category: pt.usaa_category,
      is_internal_transfer: transfer,
      is_manually_categorized: false,
      csv_import_id: csvImport.id,
      tag_ids: [],
    });
  }

  store.addTransactionsBulk(newTxns);

  // Update import record count
  const impRecord = store.csvImports.find((i) => i.id === csvImport.id);
  if (impRecord) impRecord.new_transaction_count = newTxns.length;

  const newCount = newTxns.length;

  return {
    csv_import_id: csvImport.id,
    filename,
    total_rows: parsed.length,
    new_transactions: newCount,
    duplicate_transactions: duplicateCount,
    categorized_count: categorizedCount,
    uncategorized_count: newCount - categorizedCount,
    errors: [],
  };
}
