import type { BudgetStore } from "./store";
import type {
  BudgetTarget,
  BudgetTransaction,
  TargetStatus,
} from "./types";

export function getMonthBounds(
  year: number,
  month: number
): [string, string] {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return [start, end];
}

export function formatCents(cents: number): string {
  const prefix = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${prefix}$${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
}

export interface TargetAssessment {
  target_id: number;
  target_name: string;
  target_type: string;
  direction: string;
  period_start: string;
  period_end: string;
  actual_value: number;
  target_value: number;
  tolerance_upper: number;
  tolerance_lower: number;
  status: TargetStatus;
}

function buildBaseFilter(
  store: BudgetStore,
  target: BudgetTarget,
  periodStart: string,
  periodEnd: string
): BudgetTransaction[] {
  let txns = store.transactions.filter(
    (t) =>
      t.date >= periodStart &&
      t.date <= periodEnd &&
      !t.is_internal_transfer
  );

  if (target.category_id != null) {
    txns = txns.filter((t) => t.category_id === target.category_id);
  } else if (
    target.spend_group === "discretionary" ||
    target.spend_group === "anomalous"
  ) {
    const excludedCatIds = new Set(
      store.targets
        .filter(
          (t) =>
            (t.spend_group === "necessary" || t.spend_group === "income") &&
            t.is_active &&
            t.category_id != null
        )
        .map((t) => t.category_id!)
    );
    txns = txns.filter(
      (t) => t.category_id == null || !excludedCatIds.has(t.category_id)
    );
  }

  if (target.description_pattern != null) {
    const pattern = target.description_pattern.toUpperCase();
    txns = txns.filter((t) => t.description.toUpperCase().includes(pattern));
  }

  if (target.person_scope != null) {
    const member = store.memberByName(target.person_scope);
    if (member) {
      txns = txns.filter((t) => t.household_member_id === member.id);
    } else {
      txns = [];
    }
  }

  return txns;
}

function computeActual(
  store: BudgetStore,
  target: BudgetTarget,
  periodStart: string,
  periodEnd: string
): number {
  let txns = buildBaseFilter(store, target, periodStart, periodEnd);

  if (target.target_type === "count") {
    return txns.length;
  }

  if (target.direction === "at_most") {
    txns = txns.filter((t) => t.amount_cents < 0);
    const sum = txns.reduce((acc, t) => acc + t.amount_cents, 0);
    return Math.abs(sum);
  } else if (target.direction === "at_least") {
    txns = txns.filter((t) => t.amount_cents > 0);
    return txns.reduce((acc, t) => acc + t.amount_cents, 0);
  } else {
    const sum = txns.reduce((acc, t) => acc + t.amount_cents, 0);
    return Math.abs(sum);
  }
}

function assessStatus(actual: number, target: BudgetTarget): TargetStatus {
  const value = target.value;

  if (target.direction === "at_most") {
    if (actual <= value) return "on_target";
    if (actual <= value + target.tolerance_upper) return "in_tolerance";
    return "off_target";
  }

  if (target.direction === "at_least") {
    if (actual >= value) return "on_target";
    if (actual >= value - target.tolerance_lower) return "in_tolerance";
    return "off_target";
  }

  // exactly
  const lower = value - target.tolerance_lower;
  const upper = value + target.tolerance_upper;
  if (actual >= lower && actual <= upper) {
    return actual === value ? "on_target" : "in_tolerance";
  }
  return "off_target";
}

export function assessTarget(
  store: BudgetStore,
  target: BudgetTarget,
  periodStart: string,
  periodEnd: string
): TargetAssessment {
  const actual = computeActual(store, target, periodStart, periodEnd);
  const status = assessStatus(actual, target);

  return {
    target_id: target.id,
    target_name: target.name,
    target_type: target.target_type,
    direction: target.direction,
    period_start: periodStart,
    period_end: periodEnd,
    actual_value: actual,
    target_value: target.value,
    tolerance_upper: target.tolerance_upper,
    tolerance_lower: target.tolerance_lower,
    status,
  };
}

export function assessAllTargets(
  store: BudgetStore,
  year: number,
  month: number
): TargetAssessment[] {
  const [start, end] = getMonthBounds(year, month);
  return store.targets
    .filter((t) => t.is_active)
    .map((t) => assessTarget(store, t, start, end));
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBRS = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface MonthInfo {
  year: number;
  month: number;
  label: string;
  transaction_count: number;
}

export function getAvailableMonths(store: BudgetStore): MonthInfo[] {
  const map = new Map<string, number>();
  for (const txn of store.transactions) {
    const y = parseInt(txn.date.slice(0, 4), 10);
    const m = parseInt(txn.date.slice(5, 7), 10);
    const key = `${y}-${m}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const months: MonthInfo[] = [];
  for (const [key, count] of map) {
    const [y, m] = key.split("-").map(Number);
    months.push({
      year: y,
      month: m,
      label: `${MONTH_NAMES[m]} ${y}`,
      transaction_count: count,
    });
  }

  months.sort((a, b) => b.year - a.year || b.month - a.month);
  return months;
}

export interface CumulativeDataPoint {
  date: string;
  cumulative_value: number;
  cumulative_display: string;
}

export function getCumulativeDaily(
  store: BudgetStore,
  target: BudgetTarget,
  periodStart: string,
  periodEnd: string
): CumulativeDataPoint[] {
  let txns = buildBaseFilter(store, target, periodStart, periodEnd);

  if (target.target_type === "monetary" && target.direction === "at_most") {
    txns = txns.filter((t) => t.amount_cents < 0);
  } else if (target.target_type === "monetary" && target.direction === "at_least") {
    txns = txns.filter((t) => t.amount_cents > 0);
  }

  // Group by date
  const dailyMap = new Map<string, number>();
  for (const txn of txns) {
    if (target.target_type === "count") {
      dailyMap.set(txn.date, (dailyMap.get(txn.date) ?? 0) + 1);
    } else {
      dailyMap.set(txn.date, (dailyMap.get(txn.date) ?? 0) + txn.amount_cents);
    }
  }

  const dates = [...dailyMap.keys()].sort();
  const result: CumulativeDataPoint[] = [];
  let cumulative = 0;

  for (const date of dates) {
    let dailyVal = dailyMap.get(date)!;
    if (target.target_type === "monetary") {
      dailyVal = Math.abs(dailyVal);
    }
    cumulative += dailyVal;
    result.push({
      date,
      cumulative_value: cumulative,
      cumulative_display:
        target.target_type === "monetary"
          ? formatCents(cumulative)
          : String(cumulative),
    });
  }

  return result;
}

export function getTargetTransactions(
  store: BudgetStore,
  target: BudgetTarget,
  periodStart: string,
  periodEnd: string
): BudgetTransaction[] {
  let txns = buildBaseFilter(store, target, periodStart, periodEnd);

  if (target.target_type === "monetary" && target.direction === "at_most") {
    txns = txns.filter((t) => t.amount_cents < 0);
  } else if (target.target_type === "monetary" && target.direction === "at_least") {
    txns = txns.filter((t) => t.amount_cents > 0);
  }

  txns.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  return txns;
}

export function getLaneHistory(
  store: BudgetStore,
  spendGroup: string
): {
  spend_group: string;
  months: {
    year: number;
    month: number;
    label: string;
    actual_value: number;
    actual_display: string;
    target_value: number;
    target_display: string;
    status: TargetStatus;
  }[];
} {
  const targets = store.targets.filter(
    (t) => t.spend_group === spendGroup && t.is_active
  );
  if (targets.length === 0) {
    return { spend_group: spendGroup, months: [] };
  }

  const available = getAvailableMonths(store);
  const isSpending = spendGroup !== "income";

  const months = available.map(({ year, month }) => {
    const [start, end] = getMonthBounds(year, month);

    let totalActual = 0;
    let totalTarget = 0;
    let totalTolUpper = 0;
    let totalTolLower = 0;

    for (const target of targets) {
      const assessment = assessTarget(store, target, start, end);
      totalActual += assessment.actual_value;
      totalTarget += assessment.target_value;
      totalTolUpper += target.tolerance_upper;
      totalTolLower += target.tolerance_lower;
    }

    let status: TargetStatus;
    if (isSpending) {
      if (totalActual <= totalTarget) status = "on_target";
      else if (totalActual <= totalTarget + totalTolUpper) status = "in_tolerance";
      else status = "off_target";
    } else {
      if (totalActual >= totalTarget) status = "on_target";
      else if (totalActual >= totalTarget - totalTolLower) status = "in_tolerance";
      else status = "off_target";
    }

    const label = `${MONTH_ABBRS[month]} ${year}`;
    return {
      year,
      month,
      label,
      actual_value: totalActual,
      actual_display: formatCents(totalActual),
      target_value: totalTarget,
      target_display: formatCents(totalTarget),
      status,
    };
  });

  months.sort((a, b) => a.year - b.year || a.month - b.month);
  return { spend_group: spendGroup, months };
}

export function getTargetHistory(
  store: BudgetStore,
  targetId: number
): {
  target_id: number;
  target_name: string;
  direction: string;
  months: {
    year: number;
    month: number;
    label: string;
    actual_value: number;
    actual_display: string;
    target_value: number;
    target_display: string;
    status: TargetStatus;
  }[];
} | null {
  const target = store.targetById(targetId);
  if (!target) return null;

  const available = getAvailableMonths(store);
  const isMonetary = target.target_type === "monetary";

  const months = available.map(({ year, month }) => {
    const [start, end] = getMonthBounds(year, month);
    const assessment = assessTarget(store, target, start, end);
    const label = `${MONTH_ABBRS[month]} ${year}`;
    return {
      year,
      month,
      label,
      actual_value: assessment.actual_value,
      actual_display: isMonetary
        ? formatCents(assessment.actual_value)
        : String(assessment.actual_value),
      target_value: assessment.target_value,
      target_display: isMonetary
        ? formatCents(assessment.target_value)
        : String(assessment.target_value),
      status: assessment.status,
    };
  });

  months.sort((a, b) => a.year - b.year || a.month - b.month);

  return {
    target_id: target.id,
    target_name: target.name,
    direction: target.direction,
    months,
  };
}
