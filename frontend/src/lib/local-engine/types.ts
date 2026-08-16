export type SpendGroup = "income" | "necessary" | "discretionary" | "anomalous";
export type TargetType = "monetary" | "count";
export type Direction = "at_most" | "at_least" | "exactly";
export type MatchType = "substring" | "regex";
export type AccountType = "checking" | "credit" | "savings";
export type OwnerType = "joint" | "personal";
export type TargetStatus = "on_target" | "in_tolerance" | "off_target";

export interface BudgetAccount {
  id: number;
  name: string;
  institution: string;
  account_type: AccountType;
  owner_type: OwnerType;
  household_member_id: number | null;
  created_at: string;
}

export interface BudgetHouseholdMember {
  id: number;
  name: string;
  created_at: string;
}

export interface BudgetCategory {
  id: number;
  name: string;
  parent_category_id: number | null;
  created_at: string;
}

export interface BudgetCategoryRule {
  id: number;
  pattern: string;
  match_type: MatchType;
  category_id: number;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface BudgetTarget {
  id: number;
  name: string;
  target_type: TargetType;
  direction: Direction;
  value: number;
  tolerance_upper: number;
  tolerance_lower: number;
  period: string;
  person_scope: string | null;
  category_id: number | null;
  description_pattern: string | null;
  spend_group: SpendGroup;
  is_active: boolean;
  created_at: string;
}

export interface BudgetTransaction {
  id: number;
  external_hash: string;
  date: string;
  description: string;
  raw_description: string;
  amount_cents: number;
  account_id: number;
  household_member_id: number | null;
  category_id: number | null;
  usaa_category: string | null;
  is_internal_transfer: boolean;
  is_manually_categorized: boolean;
  is_excluded: boolean;
  is_pending: boolean;
  csv_import_id: number | null;
  tag_ids: number[];
  created_at: string;
}

export interface BudgetCsvImport {
  id: number;
  filename: string;
  file_hash: string;
  imported_at: string;
  row_count: number;
  new_transaction_count: number;
  account_id: number;
}

export interface BudgetTag {
  id: number;
  name: string;
  dimension: string;
  created_at: string;
}

/**
 * A credit card (or other revolving debt) the household is paying off, for the
 * Debt Trajectory feature.
 *
 * We deliberately do NOT parse statements. The user reads the numbers off a
 * single statement (the "anchor") and we project the payoff forward from there,
 * treating the anchor balance as a fixed amount to pay down — new purchases on
 * the card are intentionally ignored (re-anchoring is the correction path).
 *
 * Which transactions count as payments is decided by the existing category
 * system: any transaction in one of `payment_category_ids` (dated on/after the
 * anchor) is summed, by month, as a payment. Payments are usually internal
 * transfers, so — unlike the target engine — the debt engine does NOT filter
 * out `is_internal_transfer` rows.
 */
export interface BudgetDebt {
  id: number;
  name: string;
  account_id: number | null; // optional link to a BudgetAccount of type "credit"

  // Single-statement anchor — the core input assumption.
  anchor_date: string; // "YYYY-MM-DD" — the statement date the balance was read
  anchor_balance_cents: number; // balance OWED at anchor_date; positive = owed

  // Terms.
  apr_bps: number; // APR in basis points (2499 = 24.99%); integer, no float drift
  min_payment_cents: number; // fixed minimum monthly payment

  // The committed plan: the baseline "on track" trajectory is min + extra/month.
  extra_payment_cents: number;

  // Which categories' transactions are payments toward this card.
  payment_category_ids: number[];

  is_active: boolean;
  created_at: string;
}

export interface BudgetFile {
  version: number;
  exported_at: string;
  source: string;
  accounts: BudgetAccount[];
  household_members: BudgetHouseholdMember[];
  categories: BudgetCategory[];
  category_rules: BudgetCategoryRule[];
  targets: BudgetTarget[];
  transactions: BudgetTransaction[];
  csv_imports: BudgetCsvImport[];
  tags: BudgetTag[];
  debts: BudgetDebt[];
}
