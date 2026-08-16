import type { BudgetStore } from "./store";
import type { BudgetDebt } from "./types";

/**
 * Debt Trajectory engine — the payoff math for BudgetOnTarget.
 *
 * All money is integer cents; interest is rounded once per monthly step. The
 * model projects the payoff of a single anchor balance forward and is, by
 * design, an approximation. The assumptions it makes (and their inaccuracy) are:
 *
 *  1. New purchases on the card are ignored — the balance shown is "payoff of
 *     the anchor balance", not the live statement balance. Re-anchoring (editing
 *     the anchor date + balance from a fresh statement) is the correction path.
 *  2. Interest accrues as (monthly periodic rate x prior balance) — not average
 *     daily balance, and with no grace-period modeling. This slightly OVERSTATES
 *     interest vs a real card, which keeps projections from being optimistic.
 *  3. The anchor statement balance already includes interest through the anchor
 *     date, so the anchor month itself accrues no additional interest.
 *  4. APR and the minimum payment are treated as fixed.
 *  5. Payments are attributed by transaction date, not by statement cycle.
 *
 * Status compares the ACTUAL balance (from categorized payment transactions)
 * against the committed PLAN (minimum + extra every month): ahead / on_track /
 * behind. This mirrors the target engine's three-state status vocabulary.
 */

export type DebtStatus = "ahead" | "on_track" | "behind";

/** Hard cap on any forward simulation, so a too-small payment can't loop forever. */
const MAX_MONTHS = 600;

const MONTH_ABBRS = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// --- Month helpers (all months are "YYYY-MM" strings) ---

interface YM {
  y: number;
  m: number;
}

function parseYM(dateOrMonth: string): YM {
  return {
    y: parseInt(dateOrMonth.slice(0, 4), 10),
    m: parseInt(dateOrMonth.slice(5, 7), 10),
  };
}

function monthKey(ym: YM): string {
  return `${ym.y}-${String(ym.m).padStart(2, "0")}`;
}

function monthLabel(ym: YM): string {
  return `${MONTH_ABBRS[ym.m]} ${ym.y}`;
}

function addMonths(ym: YM, n: number): YM {
  const zero = ym.y * 12 + (ym.m - 1) + n;
  return { y: Math.floor(zero / 12), m: (zero % 12) + 1 };
}

function monthIndex(ym: YM): number {
  return ym.y * 12 + (ym.m - 1);
}

/** Whole-month difference b - a (positive => b is later). */
function monthDiff(aKey: string, bKey: string): number {
  return monthIndex(parseYM(bKey)) - monthIndex(parseYM(aKey));
}

function currentYM(): YM {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1 };
}

// --- Payment aggregation ---

/**
 * Sum, by month, the transactions that count as payments toward this debt.
 * A payment is any transaction whose category is in `payment_category_ids`,
 * dated on/after the anchor (earlier payments are already baked into the anchor
 * balance), and not excluded. We take abs() so it works whether payments are
 * recorded on the checking side (negative) or credit side (positive), and we do
 * NOT filter internal transfers — card payments usually ARE internal transfers.
 */
function paymentsByMonth(store: BudgetStore, debt: BudgetDebt): Map<string, number> {
  const catSet = new Set(debt.payment_category_ids);
  const map = new Map<string, number>();
  if (catSet.size === 0) return map;
  for (const t of store.transactions) {
    if (t.category_id == null || !catSet.has(t.category_id)) continue;
    if (t.is_excluded) continue;
    if (t.date < debt.anchor_date) continue;
    const key = t.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount_cents));
  }
  return map;
}

// --- Core simulation ---

interface SimResult {
  months: number | null; // null => never pays off within the cap
  totalInterest: number | null;
  neverPaysOff: boolean;
}

/**
 * Simulate paying off `startCents` with a fixed monthly `paymentCents` at
 * monthly rate `r`. Returns whole months to payoff and total interest paid.
 * Interest accrues before the payment each month (conservative).
 */
function simulatePayoff(startCents: number, r: number, paymentCents: number): SimResult {
  if (startCents <= 0) return { months: 0, totalInterest: 0, neverPaysOff: false };
  let balance = startCents;
  let totalInterest = 0;
  for (let n = 1; n <= MAX_MONTHS; n++) {
    const interest = Math.round(balance * r);
    // If the payment can't cover the interest, the balance never shrinks.
    if (paymentCents <= interest) {
      return { months: null, totalInterest: null, neverPaysOff: true };
    }
    balance = balance + interest - paymentCents;
    totalInterest += interest;
    if (balance <= 0) return { months: n, totalInterest, neverPaysOff: false };
  }
  return { months: null, totalInterest: null, neverPaysOff: true };
}

// --- Public shapes ---

export interface DebtMonthPoint {
  month_key: string;
  label: string;
  actual_balance: number | null; // cents; null in the future
  planned_balance: number | null; // cents; the committed-plan reference line
  projected_balance: number | null; // cents; null before "now"
}

export interface DebtMonthHistory {
  month_key: string;
  label: string;
  actual_balance: number;
  planned_balance: number;
  status: DebtStatus;
}

export interface DebtScenario {
  extra_cents: number;
  monthly_payment_cents: number; // min + extra
  payoff_month_key: string | null;
  payoff_label: string | null;
  months_remaining: number | null;
  total_interest_cents: number | null;
  interest_saved_cents: number; // vs minimum-only, from the current balance
  never_pays_off: boolean;
}

export interface DebtTrajectory {
  debt_id: number;
  name: string;
  anchor_date: string;
  anchor_balance_cents: number;
  apr_bps: number;
  min_payment_cents: number;
  extra_payment_cents: number;

  current_balance_cents: number;
  as_of_month_key: string;
  is_paid_off: boolean;

  /** The minimum payment expressed as a % of the current balance (display-only). */
  min_payment_percent: number | null;

  baseline_payoff_month_key: string | null;
  baseline_payoff_label: string | null;
  projected_payoff_month_key: string | null;
  projected_payoff_label: string | null;
  months_remaining: number | null;
  total_interest_remaining_cents: number | null;
  date_drift_months: number | null; // projected - baseline; + => later than plan

  status: DebtStatus;
  gap_cents: number; // planned - actual at "now"; + => ahead (owe less than plan)
  tolerance_cents: number;
  never_pays_off: boolean;

  curve: DebtMonthPoint[];
  months: DebtMonthHistory[];
}

// --- Shared "actual to date" pass ---

interface ActualState {
  currentBalance: number;
  currentKey: string;
  currentYM: YM;
  /** End-of-month balance for every month from the anchor month through now. */
  actualByMonth: Map<string, number>;
}

/**
 * Walk month-by-month from the anchor to the current month, accruing interest
 * and subtracting that month's actual payments, to get the estimated current
 * balance. The anchor month accrues no interest (assumption #3 above).
 */
function computeActualToDate(store: BudgetStore, debt: BudgetDebt, r: number): ActualState {
  const anchor = parseYM(debt.anchor_date);
  const now = currentYM();
  const payByMonth = paymentsByMonth(store, debt);
  const actualByMonth = new Map<string, number>();

  let balance = debt.anchor_balance_cents;
  let cur = anchor;
  // If the anchor is in the future, there is nothing to walk — start there.
  const lastIndex = Math.max(monthIndex(anchor), monthIndex(now));

  while (true) {
    const key = monthKey(cur);
    const isAnchorMonth = monthIndex(cur) === monthIndex(anchor);
    if (!isAnchorMonth) {
      balance = balance + Math.round(balance * r);
    }
    balance = Math.max(0, balance - (payByMonth.get(key) ?? 0));
    actualByMonth.set(key, balance);
    if (monthIndex(cur) >= lastIndex) break;
    cur = addMonths(cur, 1);
  }

  return {
    currentBalance: balance,
    currentKey: monthKey(cur),
    currentYM: cur,
    actualByMonth,
  };
}

/**
 * Simulate a balance forward under a fixed payment, recording each month's
 * end balance into `out` and returning the payoff month key (or null).
 * The starting month's balance is written under `startKey` so the caller's
 * lines connect at "now".
 */
function fillForward(
  startCents: number,
  startYM: YM,
  r: number,
  paymentCents: number,
  out: Map<string, number>
): string | null {
  out.set(monthKey(startYM), Math.max(0, startCents));
  if (startCents <= 0) return monthKey(startYM);
  let balance = startCents;
  let cur = startYM;
  for (let n = 1; n <= MAX_MONTHS; n++) {
    const interest = Math.round(balance * r);
    if (paymentCents <= interest) return null; // never pays off
    balance = Math.max(0, balance + interest - paymentCents);
    cur = addMonths(cur, 1);
    out.set(monthKey(cur), balance);
    if (balance <= 0) return monthKey(cur);
  }
  return null;
}

function classify(gapCents: number, toleranceCents: number): DebtStatus {
  if (gapCents > toleranceCents) return "ahead";
  if (gapCents < -toleranceCents) return "behind";
  return "on_track";
}

/** Full trajectory assessment for one debt. */
export function assessDebt(store: BudgetStore, debt: BudgetDebt): DebtTrajectory {
  const r = debt.apr_bps / 10000 / 12;
  const anchor = parseYM(debt.anchor_date);
  const planPayment = debt.min_payment_cents + debt.extra_payment_cents;

  const actual = computeActualToDate(store, debt, r);
  const { currentBalance, currentKey } = actual;
  const isPaidOff = currentBalance <= 0;

  // Baseline plan (min + extra) from the anchor forward — the "should-be" line.
  const plannedByMonth = new Map<string, number>();
  const baselinePayoffKey = fillForward(
    debt.anchor_balance_cents,
    anchor,
    r,
    planPayment,
    plannedByMonth
  );

  // Forward projection from the current balance, continuing the plan.
  const projByMonth = new Map<string, number>();
  const projectedPayoffKey = fillForward(
    currentBalance,
    actual.currentYM,
    r,
    planPayment,
    projByMonth
  );

  // Interest + months remaining from the current balance under the plan.
  const forwardSim = simulatePayoff(currentBalance, r, planPayment);

  // Status: compare where the plan says the balance should be now vs actual.
  const expectedNow = plannedByMonth.has(currentKey)
    ? plannedByMonth.get(currentKey)!
    : 0; // plan would already be paid off => any balance is "behind"
  const toleranceCents = Math.max(
    Math.round(currentBalance * r), // roughly one month's interest
    Math.round(debt.anchor_balance_cents * 0.01), // or 1% of the anchor
    500 // never tighter than $5, to avoid noise near payoff
  );
  const gapCents = expectedNow - currentBalance;
  const status: DebtStatus = isPaidOff ? "ahead" : classify(gapCents, toleranceCents);

  const dateDriftMonths =
    baselinePayoffKey != null && projectedPayoffKey != null
      ? monthDiff(baselinePayoffKey, projectedPayoffKey)
      : null;

  // Assemble the chart curve across the full span.
  const lastKey = [currentKey, baselinePayoffKey, projectedPayoffKey]
    .filter((k): k is string => k != null)
    .reduce((a, b) => (monthIndex(parseYM(a)) >= monthIndex(parseYM(b)) ? a : b), currentKey);
  const span = monthIndex(parseYM(lastKey)) - monthIndex(anchor);
  const curve: DebtMonthPoint[] = [];
  for (let i = 0; i <= span; i++) {
    const ym = addMonths(anchor, i);
    const key = monthKey(ym);
    curve.push({
      month_key: key,
      label: monthLabel(ym),
      actual_balance: actual.actualByMonth.has(key)
        ? actual.actualByMonth.get(key)!
        : null,
      planned_balance: plannedByMonth.has(key) ? plannedByMonth.get(key)! : null,
      projected_balance: projByMonth.has(key) ? projByMonth.get(key)! : null,
    });
  }

  // Per-month history strip: each actual month vs the plan for that month.
  const months: DebtMonthHistory[] = [];
  for (const [key, actualBalance] of actual.actualByMonth) {
    const plannedBalance = plannedByMonth.has(key) ? plannedByMonth.get(key)! : 0;
    const monthGap = plannedBalance - actualBalance;
    months.push({
      month_key: key,
      label: monthLabel(parseYM(key)),
      actual_balance: actualBalance,
      planned_balance: plannedBalance,
      status: actualBalance <= 0 ? "ahead" : classify(monthGap, toleranceCents),
    });
  }
  months.sort((a, b) => monthIndex(parseYM(a.month_key)) - monthIndex(parseYM(b.month_key)));

  return {
    debt_id: debt.id,
    name: debt.name,
    anchor_date: debt.anchor_date,
    anchor_balance_cents: debt.anchor_balance_cents,
    apr_bps: debt.apr_bps,
    min_payment_cents: debt.min_payment_cents,
    extra_payment_cents: debt.extra_payment_cents,

    current_balance_cents: currentBalance,
    as_of_month_key: currentKey,
    is_paid_off: isPaidOff,

    min_payment_percent:
      currentBalance > 0
        ? Math.round((debt.min_payment_cents / currentBalance) * 1000) / 10
        : null,

    baseline_payoff_month_key: baselinePayoffKey,
    baseline_payoff_label: baselinePayoffKey ? monthLabel(parseYM(baselinePayoffKey)) : null,
    projected_payoff_month_key: projectedPayoffKey,
    projected_payoff_label: projectedPayoffKey ? monthLabel(parseYM(projectedPayoffKey)) : null,
    months_remaining: forwardSim.months,
    total_interest_remaining_cents: forwardSim.totalInterest,
    date_drift_months: dateDriftMonths,

    status,
    gap_cents: gapCents,
    tolerance_cents: toleranceCents,
    never_pays_off: forwardSim.neverPaysOff,

    curve,
    months,
  };
}

/**
 * A "what if I pay $X extra per month" scenario, computed from the current
 * balance. `interest_saved_cents` compares against paying only the minimum.
 */
export function scenarioDebt(
  store: BudgetStore,
  debt: BudgetDebt,
  extraCents: number
): DebtScenario {
  const r = debt.apr_bps / 10000 / 12;
  const { currentBalance, currentYM: startYM } = computeActualToDate(store, debt, r);
  const payment = debt.min_payment_cents + Math.max(0, extraCents);

  const sim = simulatePayoff(currentBalance, r, payment);
  const minSim = simulatePayoff(currentBalance, r, debt.min_payment_cents);

  const payoffYM = sim.months != null ? addMonths(startYM, sim.months) : null;
  const interestSaved =
    !minSim.neverPaysOff && !sim.neverPaysOff && minSim.totalInterest != null && sim.totalInterest != null
      ? Math.max(0, minSim.totalInterest - sim.totalInterest)
      : 0;

  return {
    extra_cents: extraCents,
    monthly_payment_cents: payment,
    payoff_month_key: payoffYM ? monthKey(payoffYM) : null,
    payoff_label: payoffYM ? monthLabel(payoffYM) : null,
    months_remaining: sim.months,
    total_interest_cents: sim.totalInterest,
    interest_saved_cents: interestSaved,
    never_pays_off: sim.neverPaysOff,
  };
}
