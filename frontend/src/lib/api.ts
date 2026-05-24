import type {
  DashboardResponse,
  CumulativeResponse,
  TransactionListResponse,
  MonthInfo,
  Category,
  CategoryRule,
  Target,
  ImportResult,
  ImportRecord,
  Account,
  HouseholdMember,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  // Only set Content-Type for non-FormData requests
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, error.detail || res.statusText);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  dashboard: {
    getAssessments: (year: number, month: number) =>
      fetchApi<DashboardResponse>(
        `/dashboard/assessments?year=${year}&month=${month}`
      ),
    getCumulative: (year: number, month: number, targetIds?: number[]) =>
      fetchApi<CumulativeResponse>(
        `/dashboard/cumulative?year=${year}&month=${month}${
          targetIds ? `&target_ids=${targetIds.join(",")}` : ""
        }`
      ),
  },

  transactions: {
    list: (
      params: Record<string, string | number | boolean | undefined>
    ) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") searchParams.set(k, String(v));
      });
      return fetchApi<TransactionListResponse>(
        `/transactions?${searchParams.toString()}`
      );
    },
    getMonths: () => fetchApi<MonthInfo[]>("/transactions/months"),
    categorize: (
      id: number,
      body: {
        category_id: number;
        create_rule?: boolean;
        rule_pattern?: string;
        rule_match_type?: string;
      }
    ) =>
      fetchApi<{
        transaction: Record<string, unknown>;
        rule_created: boolean;
        rule_id: number | null;
        retroactive_count: number;
      }>(`/transactions/${id}/categorize`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },

  categories: {
    list: () => fetchApi<Category[]>("/categories"),
    create: (body: { name: string; parent_category_id?: number | null }) =>
      fetchApi<Category>("/categories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchApi<void>(`/categories/${id}`, { method: "DELETE" }),
  },

  categoryRules: {
    list: (categoryId?: number) => {
      const params = categoryId ? `?category_id=${categoryId}` : "";
      return fetchApi<CategoryRule[]>(`/category-rules${params}`);
    },
    create: (body: {
      pattern: string;
      match_type: string;
      category_id: number;
      priority: number;
    }) =>
      fetchApi<CategoryRule>("/category-rules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (
      id: number,
      body: Partial<{
        pattern: string;
        match_type: string;
        category_id: number;
        priority: number;
        is_active: boolean;
      }>
    ) =>
      fetchApi<CategoryRule>(`/category-rules/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchApi<void>(`/category-rules/${id}`, { method: "DELETE" }),
    recategorize: () =>
      fetchApi<{ updated_count: number }>("/category-rules/recategorize", {
        method: "POST",
      }),
  },

  targets: {
    list: () => fetchApi<Target[]>("/targets"),
    create: (body: {
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
      is_active: boolean;
    }) =>
      fetchApi<Target>("/targets", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (
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
        is_active: boolean;
      }
    ) =>
      fetchApi<Target>(`/targets/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchApi<void>(`/targets/${id}`, { method: "DELETE" }),
  },

  imports: {
    upload: (file: File, accountId: number) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("account_id", String(accountId));
      return fetch(`${API_BASE}/imports/upload`, {
        method: "POST",
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res
            .json()
            .catch(() => ({ detail: res.statusText }));
          throw new ApiError(res.status, error.detail || res.statusText);
        }
        return res.json() as Promise<ImportResult>;
      });
    },
    list: () => fetchApi<ImportRecord[]>("/imports"),
  },

  accounts: {
    list: () => fetchApi<Account[]>("/accounts"),
    create: (body: {
      name: string;
      institution: string;
      account_type: string;
    }) =>
      fetchApi<Account>("/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  householdMembers: {
    list: () => fetchApi<HouseholdMember[]>("/household-members"),
    create: (body: { name: string; card_identifiers: string }) =>
      fetchApi<HouseholdMember>("/household-members", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
};
