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
}
