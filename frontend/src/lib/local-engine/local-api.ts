import type {
  DashboardResponse,
  CumulativeResponse,
  TransactionListResponse,
  Transaction as TransactionResponse,
  MonthInfo,
  Category,
  CategoryRule,
  Target,
  TargetHistoryResponse,
  LaneHistoryResponse,
  ImportResult,
  ImportRecord,
  Account,
  HouseholdMember,
} from "@/types";

import { BudgetStore } from "./store";
import {
  assessAllTargets,
  assessTarget,
  formatCents,
  getAvailableMonths,
  getCumulativeDaily,
  getLaneHistory,
  getMonthBounds,
  getTargetHistory,
  getTargetTransactions,
} from "./target-engine";
import { categorize, recategorizeAll } from "./categorizer";
import { importCsv } from "./importer";

const store = new BudgetStore();

export function getStore(): BudgetStore {
  return store;
}

function txnToResponse(txn: {
  id: number;
  date: string;
  description: string;
  raw_description: string;
  amount_cents: number;
  account_id: number;
  household_member_id: number | null;
  category_id: number | null;
  is_manually_categorized: boolean;
  is_internal_transfer: boolean;
  usaa_category: string | null;
}): TransactionResponse {
  const account = store.accountById(txn.account_id);
  const member = txn.household_member_id
    ? store.memberById(txn.household_member_id)
    : undefined;
  const category = txn.category_id
    ? store.categoryById(txn.category_id)
    : undefined;

  return {
    id: txn.id,
    date: txn.date,
    description: txn.description,
    raw_description: txn.raw_description,
    amount_cents: txn.amount_cents,
    amount_display: formatCents(txn.amount_cents),
    account_id: txn.account_id,
    account_name: account?.name ?? "",
    household_member_id: txn.household_member_id,
    household_member_name: member?.name ?? null,
    category_id: txn.category_id,
    category_name: category?.name ?? null,
    is_manually_categorized: txn.is_manually_categorized,
    is_internal_transfer: txn.is_internal_transfer,
    usaa_category: txn.usaa_category,
  };
}

const MONTH_NAMES = [
  "",
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const localApi = {
  dashboard: {
    getAssessments: async (
      year: number,
      month: number
    ): Promise<DashboardResponse> => {
      const assessments = assessAllTargets(store, year, month);
      const available = getAvailableMonths(store);

      return {
        period: {
          year,
          month,
          label: `${MONTH_NAMES[month]} ${year}`,
        },
        assessments: assessments.map((a) => {
          const target = store.targetById(a.target_id)!;
          const isMonetary = a.target_type === "monetary";
          const pct =
            a.target_value > 0
              ? Math.round((a.actual_value / a.target_value) * 1000) / 10
              : a.actual_value > 0
                ? 100
                : 0;

          const history = available.map(({ year: hy, month: hm }) => {
            const [hs, he] = getMonthBounds(hy, hm);
            const ha = assessTarget(store, target, hs, he);
            return { year: hy, month: hm, status: ha.status };
          });
          history.sort((a, b) => a.year - b.year || a.month - b.month);

          return {
            target_id: a.target_id,
            target_name: a.target_name,
            target_type: a.target_type as "monetary" | "count",
            direction: a.direction as "at_most" | "at_least" | "exactly",
            spend_group: target.spend_group,
            actual_value: a.actual_value,
            actual_display: isMonetary
              ? formatCents(a.actual_value)
              : String(a.actual_value),
            target_value: a.target_value,
            target_display: isMonetary
              ? formatCents(a.target_value)
              : String(a.target_value),
            tolerance_upper: a.tolerance_upper,
            tolerance_lower: a.tolerance_lower,
            status: a.status,
            percent_of_target: pct,
            history,
          };
        }),
      };
    },

    getCumulative: async (
      year: number,
      month: number,
      targetIds?: number[]
    ): Promise<CumulativeResponse> => {
      const [start, end] = getMonthBounds(year, month);
      let targets = store.targets.filter((t) => t.is_active);
      if (targetIds) {
        const idSet = new Set(targetIds);
        targets = targets.filter((t) => idSet.has(t.id));
      }

      return {
        period: { year, month },
        targets: targets.map((t) => {
          const isMonetary = t.target_type === "monetary";
          return {
            target_id: t.id,
            target_name: t.name,
            target_value: t.value,
            target_display: isMonetary
              ? formatCents(t.value)
              : String(t.value),
            direction: t.direction,
            spend_group: t.spend_group,
            data_points: getCumulativeDaily(store, t, start, end),
          };
        }),
      };
    },

    getTargetTransactions: async (
      targetId: number,
      year: number,
      month: number,
      endYear?: number,
      endMonth?: number
    ): Promise<TransactionListResponse> => {
      const target = store.targetById(targetId);
      if (!target) throw new Error("Target not found");

      const [pStart] = getMonthBounds(year, month);
      const [, pEnd] =
        endYear != null && endMonth != null
          ? getMonthBounds(endYear, endMonth)
          : getMonthBounds(year, month);

      const txns = getTargetTransactions(store, target, pStart, pEnd);
      const responses = txns.map(txnToResponse);

      return {
        transactions: responses,
        total_count: responses.length,
        limit: responses.length,
        offset: 0,
      };
    },

    getTargetHistory: async (targetId: number): Promise<TargetHistoryResponse> => {
      const result = getTargetHistory(store, targetId);
      if (!result) throw new Error("Target not found");
      return result;
    },

    getLaneHistory: async (spendGroup: string): Promise<LaneHistoryResponse> => {
      return getLaneHistory(store, spendGroup);
    },
  },

  transactions: {
    list: async (
      params: Record<string, string | number | boolean | undefined>
    ): Promise<TransactionListResponse> => {
      let txns = [...store.transactions];

      const year = params.year != null ? Number(params.year) : undefined;
      const month = params.month != null ? Number(params.month) : undefined;

      if (year != null && month != null) {
        const [start, end] = getMonthBounds(year, month);
        txns = txns.filter((t) => t.date >= start && t.date <= end);
      } else if (year != null) {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        txns = txns.filter((t) => t.date >= start && t.date <= end);
      }

      if (params.category_id != null) {
        const catId = Number(params.category_id);
        txns = txns.filter((t) => t.category_id === catId);
      } else if (params.spend_group != null) {
        const sg = String(params.spend_group);
        const laneCatIds = new Set(
          store.targets
            .filter(
              (t) =>
                t.spend_group === sg && t.is_active && t.category_id != null
            )
            .map((t) => t.category_id!)
        );
        txns = txns.filter(
          (t) => t.category_id != null && laneCatIds.has(t.category_id)
        );
      }

      if (params.household_member_id != null) {
        const mid = Number(params.household_member_id);
        txns = txns.filter((t) => t.household_member_id === mid);
      }

      if (params.is_uncategorized === true || params.is_uncategorized === "true") {
        txns = txns.filter((t) => t.category_id == null);
      }

      if (params.search) {
        const q = String(params.search).toUpperCase();
        txns = txns.filter((t) => t.description.toUpperCase().includes(q));
      }

      const totalCount = txns.length;

      const sortBy = String(params.sort_by ?? "date");
      const sortDir = String(params.sort_dir ?? "desc");
      txns.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "date") cmp = a.date.localeCompare(b.date);
        else if (sortBy === "amount_cents") cmp = a.amount_cents - b.amount_cents;
        else if (sortBy === "description")
          cmp = a.description.localeCompare(b.description);
        return sortDir === "desc" ? -cmp : cmp;
      });

      const limit = Number(params.limit ?? 100);
      const offset = Number(params.offset ?? 0);
      const page = txns.slice(offset, offset + limit);

      return {
        transactions: page.map(txnToResponse),
        total_count: totalCount,
        limit,
        offset,
      };
    },

    getMonths: async (): Promise<MonthInfo[]> => {
      return getAvailableMonths(store);
    },

    categorize: async (
      id: number,
      body: {
        category_id: number;
        create_rule?: boolean;
        rule_pattern?: string;
        rule_match_type?: string;
      }
    ) => {
      const txn = store.transactions.find((t) => t.id === id);
      if (!txn) throw new Error("Transaction not found");

      txn.category_id = body.category_id;
      txn.is_manually_categorized = true;

      let ruleCreated = false;
      let ruleId: number | null = null;
      let retroactiveCount = 0;

      if (body.create_rule && body.rule_pattern) {
        const maxPriority = store.categoryRules.reduce(
          (max, r) => Math.max(max, r.priority),
          0
        );
        const rule = store.addRule({
          pattern: body.rule_pattern,
          match_type: (body.rule_match_type ?? "substring") as "substring" | "regex",
          category_id: body.category_id,
          priority: maxPriority + 10,
          is_active: true,
        });
        ruleCreated = true;
        ruleId = rule.id;

        for (const other of store.transactions) {
          if (other.is_manually_categorized) continue;
          if (other.category_id != null) continue;
          if (other.id === id) continue;
          const catId = categorize(other.description, store.categoryRules);
          if (catId != null) {
            other.category_id = catId;
            retroactiveCount++;
          }
        }
      }

      return {
        transaction: txnToResponse(txn) as unknown as Record<string, unknown>,
        rule_created: ruleCreated,
        rule_id: ruleId,
        retroactive_count: retroactiveCount,
      };
    },
  },

  categories: {
    list: async (): Promise<Category[]> => {
      return store.categories.map((c) => ({
        id: c.id,
        name: c.name,
        parent_category_id: c.parent_category_id,
        transaction_count: store.transactions.filter(
          (t) => t.category_id === c.id
        ).length,
      }));
    },

    create: async (body: {
      name: string;
      parent_category_id?: number | null;
    }): Promise<Category> => {
      const existing = store.categories.find((c) => c.name === body.name);
      if (existing) throw new Error(`Category '${body.name}' already exists.`);
      const cat = store.addCategory({
        name: body.name,
        parent_category_id: body.parent_category_id ?? null,
      });
      return {
        id: cat.id,
        name: cat.name,
        parent_category_id: cat.parent_category_id,
        transaction_count: 0,
      };
    },

    delete: async (id: number): Promise<void> => {
      if (!store.deleteCategory(id)) throw new Error("Category not found");
    },
  },

  categoryRules: {
    list: async (categoryId?: number): Promise<CategoryRule[]> => {
      let rules = store.categoryRules;
      if (categoryId != null) {
        rules = rules.filter((r) => r.category_id === categoryId);
      }
      return rules.map((r) => ({
        id: r.id,
        pattern: r.pattern,
        match_type: r.match_type,
        category_id: r.category_id,
        category_name: store.categoryById(r.category_id)?.name ?? "",
        priority: r.priority,
        is_active: r.is_active,
        created_at: r.created_at,
      }));
    },

    create: async (body: {
      pattern: string;
      match_type: string;
      category_id: number;
      priority: number;
    }): Promise<CategoryRule> => {
      const rule = store.addRule({
        pattern: body.pattern,
        match_type: body.match_type as "substring" | "regex",
        category_id: body.category_id,
        priority: body.priority,
        is_active: true,
      });
      return {
        id: rule.id,
        pattern: rule.pattern,
        match_type: rule.match_type,
        category_id: rule.category_id,
        category_name: store.categoryById(rule.category_id)?.name ?? "",
        priority: rule.priority,
        is_active: rule.is_active,
        created_at: rule.created_at,
      };
    },

    update: async (
      id: number,
      body: Partial<{
        pattern: string;
        match_type: string;
        category_id: number;
        priority: number;
        is_active: boolean;
      }>
    ): Promise<CategoryRule> => {
      const rule = store.updateRule(id, body as Record<string, unknown>);
      if (!rule) throw new Error("Rule not found");
      return {
        id: rule.id,
        pattern: rule.pattern,
        match_type: rule.match_type,
        category_id: rule.category_id,
        category_name: store.categoryById(rule.category_id)?.name ?? "",
        priority: rule.priority,
        is_active: rule.is_active,
        created_at: rule.created_at,
      };
    },

    delete: async (id: number): Promise<void> => {
      if (!store.deleteRule(id)) throw new Error("Rule not found");
    },

    recategorize: async (): Promise<{ updated_count: number }> => {
      const count = recategorizeAll(store);
      return { updated_count: count };
    },
  },

  targets: {
    list: async (): Promise<Target[]> => {
      return store.targets.map((t) => {
        const isMonetary = t.target_type === "monetary";
        return {
          id: t.id,
          name: t.name,
          target_type: t.target_type,
          direction: t.direction,
          value: t.value,
          value_display: isMonetary ? formatCents(t.value) : String(t.value),
          tolerance_upper: t.tolerance_upper,
          tolerance_lower: t.tolerance_lower,
          tolerance_upper_display: isMonetary
            ? formatCents(t.tolerance_upper)
            : String(t.tolerance_upper),
          tolerance_lower_display: isMonetary
            ? formatCents(t.tolerance_lower)
            : String(t.tolerance_lower),
          period: t.period,
          person_scope: t.person_scope,
          category_id: t.category_id,
          category_name: t.category_id
            ? (store.categoryById(t.category_id)?.name ?? null)
            : null,
          description_pattern: t.description_pattern,
          spend_group: t.spend_group,
          is_active: t.is_active,
        };
      });
    },

    create: async (body: {
      name: string;
      target_type: string;
      direction: string;
      value: number;
      tolerance_upper: number;
      tolerance_lower: number;
      period: string;
      person_scope: string | null;
      category_id: number | null;
      description_pattern: string | null;
      spend_group: string;
      is_active: boolean;
    }): Promise<Target> => {
      const t = store.addTarget(body as Parameters<typeof store.addTarget>[0]);
      const isMonetary = t.target_type === "monetary";
      return {
        id: t.id,
        name: t.name,
        target_type: t.target_type,
        direction: t.direction,
        value: t.value,
        value_display: isMonetary ? formatCents(t.value) : String(t.value),
        tolerance_upper: t.tolerance_upper,
        tolerance_lower: t.tolerance_lower,
        tolerance_upper_display: isMonetary
          ? formatCents(t.tolerance_upper)
          : String(t.tolerance_upper),
        tolerance_lower_display: isMonetary
          ? formatCents(t.tolerance_lower)
          : String(t.tolerance_lower),
        period: t.period,
        person_scope: t.person_scope,
        category_id: t.category_id,
        category_name: t.category_id
          ? (store.categoryById(t.category_id)?.name ?? null)
          : null,
        description_pattern: t.description_pattern,
        spend_group: t.spend_group,
        is_active: t.is_active,
      };
    },

    update: async (
      id: number,
      body: {
        name: string;
        target_type: string;
        direction: string;
        value: number;
        tolerance_upper: number;
        tolerance_lower: number;
        period: string;
        person_scope: string | null;
        category_id: number | null;
        description_pattern: string | null;
        spend_group: string;
        is_active: boolean;
      }
    ): Promise<Target> => {
      const t = store.updateTarget(id, body as Record<string, unknown>);
      if (!t) throw new Error("Target not found");
      const isMonetary = t.target_type === "monetary";
      return {
        id: t.id,
        name: t.name,
        target_type: t.target_type,
        direction: t.direction,
        value: t.value,
        value_display: isMonetary ? formatCents(t.value) : String(t.value),
        tolerance_upper: t.tolerance_upper,
        tolerance_lower: t.tolerance_lower,
        tolerance_upper_display: isMonetary
          ? formatCents(t.tolerance_upper)
          : String(t.tolerance_upper),
        tolerance_lower_display: isMonetary
          ? formatCents(t.tolerance_lower)
          : String(t.tolerance_lower),
        period: t.period,
        person_scope: t.person_scope,
        category_id: t.category_id,
        category_name: t.category_id
          ? (store.categoryById(t.category_id)?.name ?? null)
          : null,
        description_pattern: t.description_pattern,
        spend_group: t.spend_group,
        is_active: t.is_active,
      };
    },

    delete: async (id: number): Promise<void> => {
      if (!store.deleteTarget(id)) throw new Error("Target not found");
    },
  },

  imports: {
    upload: async (file: File, accountId: number): Promise<ImportResult> => {
      const buffer = await file.arrayBuffer();
      return importCsv(store, buffer, file.name, accountId);
    },

    list: async (): Promise<ImportRecord[]> => {
      return store.csvImports
        .map((imp) => ({
          id: imp.id,
          filename: imp.filename,
          file_hash: imp.file_hash,
          imported_at: imp.imported_at,
          row_count: imp.row_count,
          new_transaction_count: imp.new_transaction_count,
          account_id: imp.account_id,
          account_name: store.accountById(imp.account_id)?.name ?? "",
        }))
        .sort(
          (a, b) =>
            new Date(b.imported_at).getTime() -
            new Date(a.imported_at).getTime()
        );
    },
  },

  accounts: {
    list: async (): Promise<Account[]> => {
      return store.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        account_type: a.account_type,
        owner_type: a.owner_type,
      }));
    },

    create: async (body: {
      name: string;
      institution: string;
      account_type: string;
    }): Promise<Account> => {
      const existing = store.accounts.find((a) => a.name === body.name);
      if (existing) throw new Error(`Account '${body.name}' already exists.`);
      const a = store.addAccount(
        body as Parameters<typeof store.addAccount>[0]
      );
      return {
        id: a.id,
        name: a.name,
        institution: a.institution,
        account_type: a.account_type,
        owner_type: a.owner_type,
      };
    },
  },

  householdMembers: {
    list: async (): Promise<HouseholdMember[]> => {
      return store.householdMembers.map((m) => ({
        id: m.id,
        name: m.name,
      }));
    },

    create: async (body: {
      name: string;
      card_identifiers: string;
    }): Promise<HouseholdMember> => {
      const m = store.addMember({ name: body.name });
      return { id: m.id, name: m.name };
    },
  },

  budgetFile: {
    export: async (): Promise<Blob> => {
      const data = store.serialize();
      const json = JSON.stringify(data, null, 2);
      return new Blob([json], { type: "application/json" });
    },

    import: async (
      file: File
    ): Promise<{ status: string; imported: Record<string, number> }> => {
      const text = await file.text();
      const data = JSON.parse(text);
      store.load(data);
      return {
        status: "ok",
        imported: {
          accounts: store.accounts.length,
          household_members: store.householdMembers.length,
          categories: store.categories.length,
          category_rules: store.categoryRules.length,
          targets: store.targets.length,
          transactions: store.transactions.length,
          csv_imports: store.csvImports.length,
          tags: store.tags.length,
        },
      };
    },
  },
};
