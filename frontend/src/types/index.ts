export interface Transaction {
  id: number;
  date: string;
  description: string;
  raw_description: string;
  amount_cents: number;
  amount_display: string;
  account_id: number;
  account_name: string;
  household_member_id: number | null;
  household_member_name: string | null;
  category_id: number | null;
  category_name: string | null;
  is_manually_categorized: boolean;
  is_internal_transfer: boolean;
  usaa_category: string | null;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total_count: number;
  limit: number;
  offset: number;
}

export interface MonthInfo {
  year: number;
  month: number;
  label: string;
  transaction_count: number;
}

export interface TargetAssessment {
  target_id: number;
  target_name: string;
  target_type: "monetary" | "count";
  direction: "at_most" | "at_least" | "exactly";
  spend_group: SpendGroup;
  actual_value: number;
  actual_display: string;
  target_value: number;
  target_display: string;
  tolerance_upper: number;
  tolerance_lower: number;
  status: "on_target" | "in_tolerance" | "off_target";
  percent_of_target: number;
  history: MonthStatus[];
}

export interface MonthStatus {
  year: number;
  month: number;
  status: "on_target" | "in_tolerance" | "off_target";
}

export interface DashboardResponse {
  period: { year: number; month: number; label: string };
  assessments: TargetAssessment[];
}

export interface CumulativeDataPoint {
  date: string;
  cumulative_value: number;
  cumulative_display: string;
}

export interface CumulativeTarget {
  target_id: number;
  target_name: string;
  target_value: number;
  target_display: string;
  direction: string;
  spend_group: SpendGroup;
  data_points: CumulativeDataPoint[];
}

export interface CumulativeResponse {
  period: { year: number; month: number };
  targets: CumulativeTarget[];
}

export interface LaneHistoryMonth {
  year: number;
  month: number;
  label: string;
  actual_value: number;
  actual_display: string;
  target_value: number;
  target_display: string;
  status: "on_target" | "in_tolerance" | "off_target";
}

export interface LaneHistoryResponse {
  spend_group: string;
  months: LaneHistoryMonth[];
}

export interface TargetHistoryMonth {
  year: number;
  month: number;
  label: string;
  actual_value: number;
  actual_display: string;
  target_value: number;
  target_display: string;
  status: "on_target" | "in_tolerance" | "off_target";
}

export interface TargetHistoryResponse {
  target_id: number;
  target_name: string;
  direction: string;
  months: TargetHistoryMonth[];
}

export interface Target {
  id: number;
  name: string;
  target_type: "monetary" | "count";
  direction: "at_most" | "at_least" | "exactly";
  value: number;
  value_display: string;
  tolerance_upper: number;
  tolerance_lower: number;
  tolerance_upper_display: string;
  tolerance_lower_display: string;
  period: string;
  person_scope: string | null;
  category_id: number | null;
  category_name: string | null;
  description_pattern: string | null;
  spend_group: SpendGroup;
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  parent_category_id: number | null;
  transaction_count: number;
}

export interface CategoryRule {
  id: number;
  pattern: string;
  match_type: "substring" | "regex";
  category_id: number;
  category_name: string;
  priority: number;
  is_active: boolean;
  created_at: string;
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

export interface ImportRecord {
  id: number;
  filename: string;
  file_hash: string;
  imported_at: string;
  row_count: number;
  new_transaction_count: number;
  account_id: number;
  account_name: string;
}

export interface Account {
  id: number;
  name: string;
  institution: string;
  account_type: string;
  owner_type: string;
}

export interface HouseholdMember {
  id: number;
  name: string;
}

export type TargetType = "monetary" | "count";
export type Direction = "at_most" | "at_least" | "exactly";
export type MatchType = "substring" | "regex";
export type AccountType = "checking" | "credit" | "savings";
export type TargetStatus = "on_target" | "in_tolerance" | "off_target";
export type SpendGroup = "income" | "necessary" | "discretionary" | "anomalous";
