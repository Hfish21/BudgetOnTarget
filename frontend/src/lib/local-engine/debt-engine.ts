import type { BudgetStore } from "./store";
import type { BudgetDebt } from "./types";

/**
 * Debt Trajectory engine — the payoff math for BudgetOnTarget.
 *
 * All money is integer cents; interest is rounded once per monthly step. The
 * model is, by design, an approximation. It has two regimes:
 *
 *  - PAST (anchor -> now): the balance is built from what actually happened.
 *      * Linked card (debt.account_id set): every charge on the card account
 *        after the anchor RAISES the balance, every payment/credit LOWERS it, and
 *        APR interest accrues monthly. So real spending genuinely pushes you
 *        "behind" — a $300 payment against $2,000 of new spend still grows the
 *        balance. Fee/interest categories are excluded from charges so the bank's
 *        own posted interest isn't double-counted with our APR accrual.
 *      * Unlinked card: no charge data exists, so payments come from the
 *        selected payment categories and no new spend is modeled.
 *  - FUTURE (now -> payoff): projected with APR interest, the committed plan
 *      payment (minimum + extra), and an explicit FUTURE-SPEND assumption
 *      (default 0 = "if I stop charging"; callers may pass a monthly amount to
 *      model "if I keep spending"). The plan BASELINE always assumes zero future
 *      spend — it's the ideal payoff line the actual trajectory is measured
 *      against.
 *
 * Other assumptions: interest = monthly periodic rate x prior balance (not
 * average daily balance, no grace period); the anchor statement balance already
 * includes interest through the anchor date, so the anchor month accrues none;
 * APR and the minimum payment are fixed; payments are attributed by transaction
 * date, not statement cycle. Re-anchoring from a fresh statement is the reset.
 *
 * Status compares the ACTUAL balance against where the committed PLAN (minimum +
 * extra, no new spend) says it should be: ahead / on_track / behind.
 */

export type DebtStatus = "ahead" | "on_track" | "behind";

/** Hard cap on any forward simulation, so a too-small payment can't loop forever. */
const MAX_MONTHS = 600;

/** How many trailing months feed the "recent average spend" prefill. */
const RECENT_SPEND_WINDOW = 3;

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

// --- Actual card activity aggregation ---

/**
 * Categories whose transactions represent posted interest/finance charges/fees.
 * These are excluded from "charges" on a linked card so the bank's own interest
 * line isn't double-counted with our APR accrual.
 */
function isFeeOrInterestCategory(store: BudgetStore, categoryId: number | null): boolean {
  if (categoryId == null) return false;
  const c = store.categoryById(categoryId);
  if (!c) return false;
  return /fee|interest|finance charge/i.test(c.name);
}

interface MonthActivity {
  charges: number; // increases the balance (cents, positive)
  payments: number; // decreases the balance (cents, positive)
}

/**
 * Per-month charges and payments since the anchor.
 *
 * Linked card: read straight from the card account — negatives are charges
 * (money spent), positives are payments/credits. Unlinked card: no charge data,
 * so payments come from the selected payment categories.
 */
function activityByMonth(store: BudgetStore, debt: BudgetDebt): Map<string, MonthActivity> {
  const map = new Map<string, MonthActivity>();
  const bump = (key: string): MonthActivity => {
    let a = map.get(key);
    if (!a) {
      a = { charges: 0, payments: 0 };
      map.set(key, a);
    }
    return a;
  };

  if (debt.account_id != null) {
    for (const t of store.transactions) {
      if (t.account_id !== debt.account_id) continue;
      if (t.is_excluded || t.is_pending) continue;
      if (t.date < debt.anchor_date) continue;
      const a = bump(t.date.slice(0, 7));
      if (t.amount_cents < 0) {
        if (!isFeeOrInterestCategory(store, t.category_id)) {
          a.charges += Math.abs(t.amount_cents);
        }
      } else {
        a.payments += t.amount_cents;
      }
    }
  } else {
    const catSet = new Set(debt.payment_category_ids);
    if (catSet.size > 0) {
      for (const t of store.transactions) {
        if (t.category_id == null || !catSet.has(t.category_id)) continue;
        if (t.is_excluded) continue;
        if (t.date < debt.anchor_date) continue;
        bump(t.date.slice(0, 7)).payments += Math.abs(t.amount_cents);
      }
    }
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
 * Simulate paying off `startCents` with a fixed monthly `paymentCents` at monthly
 * rate `r`, optionally with `futureChargeCents` of new spend each month. Interest
 * accrues before the payment. Returns whole months to payoff and total interest.
 */
function simulatePayoff(
  startCents: number,
  r: number,
  paymentCents: number,
  futureChargeCents = 0
): SimResult {
  if (startCents <= 0 && futureChargeCents <= 0) {
    return { months: 0, totalInterest: 0, neverPaysOff: false };
  }
  let balance = startCents;
  let totalInterest = 0;
  for (let n = 1; n <= MAX_MONTHS; n++) {
    const interest = Math.round(balance * r);
    // If interest + new spend meets or beats the payment, the balance never shrinks.
    if (interest + futureChargeCents >= paymentCents) {
      return { months: null, totalInterest: null, neverPaysOff: true };
    }
    balance = balance + interest + futureChargeCents - paymentCents;
    totalInterest += interest;
    if (balance <= 0) return { months: n, totalInterest, neverPaysOff: false };
  }
  return { months: null, totalInterest: null, neverPaysOff: true };
}

/**
 * Simulate a balance forward under a fixed payment (and optional monthly spend),
 * recording each month's end balance into `out`. Returns the payoff month key
 * (or null if it never pays off). The starting month is written under its own key
 * so the caller's lines connect at "now".
 */
function fillForward(
  startCents: number,
  startYM: YM,
  r: number,
  paymentCents: number,
  futureChargeCents: number,
  out: Map<string, number>
): string | null {
  out.set(monthKey(startYM), Math.max(0, startCents));
  if (startCents <= 0 && futureChargeCents <= 0) return monthKey(startYM);
  let balance = startCents;
  let cur = startYM;
  for (let n = 1; n <= MAX_MONTHS; n++) {
    const interest = Math.round(balance * r);
    if (interest + futureChargeCents >= paymentCents) {
      // Balance flat or growing => never pays off (unless already clear).
      return balance <= 0 && futureChargeCents <= 0 ? monthKey(cur) : null;
    }
    balance = Math.max(0, balance + interest + futureChargeCents - paymentCents);
    cur = addMonths(cur, 1);
    out.set(monthKey(cur), balance);
    if (balance <= 0) return monthKey(cur);
  }
  return null;
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

export interface DebtScenarioPoint {
  month_key: string;
  label: string;
  balance: number; // cents
}

export interface DebtScenario {
  extra_cents: number;
  monthly_payment_cents: number; // min + extra
  future_monthly_spend_cents: number; // spend assumption used
  payoff_month_key: string | null;
  payoff_label: string | null;
  months_remaining: number | null;
  total_interest_cents: number | null;
  interest_saved_cents: number; // vs minimum-only, same spend assumption
  never_pays_off: boolean;
  /** Balance from now to payoff under this scenario, for plotting on the chart. */
  curve: DebtScenarioPoint[];
}

export interface DebtTrajectory {
  debt_id: number;
  name: string;
  anchor_date: string;
  anchor_balance_cents: number;
  apr_bps: number;
  min_payment_cents: number;
  extra_payment_cents: number;

  is_linked: boolean; // spend/payments read from a linked card account
  current_balance_cents: number;
  as_of_month_key: string;
  is_paid_off: boolean;

  /** The minimum payment expressed as a % of the current balance (display-only). */
  min_payment_percent: number | null;

  /** Average monthly spend over the trailing window (linked cards; 0 otherwise). */
  recent_monthly_spend_cents: number;
  /** The future-spend assumption baked into this projection. */
  future_monthly_spend_cents: number;

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
  /** Per-month charges/payments, reused for the recent-spend average. */
  activity: Map<string, MonthActivity>;
}

/**
 * Walk month-by-month from the anchor to the current month, accruing interest and
 * applying that month's real charges (up) and payments (down), to get the
 * estimated current balance. The anchor month accrues no interest.
 */
function computeActualToDate(store: BudgetStore, debt: BudgetDebt, r: number): ActualState {
  const anchor = parseYM(debt.anchor_date);
  const now = currentYM();
  const activity = activityByMonth(store, debt);
  const actualByMonth = new Map<string, number>();

  let balance = debt.anchor_balance_cents;
  let cur = anchor;
  const lastIndex = Math.max(monthIndex(anchor), monthIndex(now));

  while (true) {
    const key = monthKey(cur);
    const isAnchorMonth = monthIndex(cur) === monthIndex(anchor);
    if (!isAnchorMonth) {
      balance = balance + Math.round(balance * r);
    }
    const a = activity.get(key);
    if (a) balance = balance + a.charges - a.payments;
    balance = Math.max(0, balance);
    actualByMonth.set(key, balance);
    if (monthIndex(cur) >= lastIndex) break;
    cur = addMonths(cur, 1);
  }

  return {
    currentBalance: balance,
    currentKey: monthKey(cur),
    currentYM: cur,
    actualByMonth,
    activity,
  };
}

/** Average monthly charges over the trailing window, ending before the current month. */
function recentMonthlySpend(activity: Map<string, MonthActivity>, nowYM: YM): number {
  let sum = 0;
  let count = 0;
  for (let i = 1; i <= RECENT_SPEND_WINDOW; i++) {
    const a = activity.get(monthKey(addMonths(nowYM, -i)));
    if (a) {
      sum += a.charges;
      count++;
    }
  }
  return count > 0 ? Math.round(sum / count) : 0;
}

function classify(gapCents: number, toleranceCents: number): DebtStatus {
  if (gapCents > toleranceCents) return "ahead";
  if (gapCents < -toleranceCents) return "behind";
  return "on_track";
}

/**
 * Full trajectory assessment for one debt.
 *
 * `futureMonthlySpendCents` is the assumption for the forward projection only
 * (default 0 = "if I stop charging"). The plan baseline and status always use
 * zero future spend, so real spending shows as falling behind the plan.
 */
export function assessDebt(
  store: BudgetStore,
  debt: BudgetDebt,
  futureMonthlySpendCents = 0
): DebtTrajectory {
  const r = debt.apr_bps / 10000 / 12;
  const anchor = parseYM(debt.anchor_date);
  const planPayment = debt.min_payment_cents + debt.extra_payment_cents;
  const futureSpend = Math.max(0, Math.round(futureMonthlySpendCents));

  const actual = computeActualToDate(store, debt, r);
  const { currentBalance, currentKey } = actual;
  const isPaidOff = currentBalance <= 0;

  // Baseline plan (min + extra, no new spend) from the anchor forward.
  const plannedByMonth = new Map<string, number>();
  const baselinePayoffKey = fillForward(
    debt.anchor_balance_cents,
    anchor,
    r,
    planPayment,
    0,
    plannedByMonth
  );

  // Forward projection from the current balance, continuing the plan, under the
  // caller's future-spend assumption.
  const projByMonth = new Map<string, number>();
  const projectedPayoffKey = fillForward(
    currentBalance,
    actual.currentYM,
    r,
    planPayment,
    futureSpend,
    projByMonth
  );

  const forwardSim = simulatePayoff(currentBalance, r, planPayment, futureSpend);

  // Status: compare where the plan says the balance should be now vs actual.
  const expectedNow = plannedByMonth.has(currentKey) ? plannedByMonth.get(currentKey)! : 0;
  const toleranceCents = Math.max(
    Math.round(currentBalance * r),
    Math.round(debt.anchor_balance_cents * 0.01),
    500
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
      actual_balance: actual.actualByMonth.has(key) ? actual.actualByMonth.get(key)! : null,
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

    is_linked: debt.account_id != null,
    current_balance_cents: currentBalance,
    as_of_month_key: currentKey,
    is_paid_off: isPaidOff,

    min_payment_percent:
      currentBalance > 0
        ? Math.round((debt.min_payment_cents / currentBalance) * 1000) / 10
        : null,

    recent_monthly_spend_cents: recentMonthlySpend(actual.activity, actual.currentYM),
    future_monthly_spend_cents: futureSpend,

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
 * A "what if I pay $X extra per month" scenario, from the current balance, under
 * the same future-spend assumption. `interest_saved_cents` compares against
 * paying only the minimum (same spend assumption).
 */
export function scenarioDebt(
  store: BudgetStore,
  debt: BudgetDebt,
  extraCents: number,
  futureMonthlySpendCents = 0
): DebtScenario {
  const r = debt.apr_bps / 10000 / 12;
  const futureSpend = Math.max(0, Math.round(futureMonthlySpendCents));
  const { currentBalance, currentYM: startYM } = computeActualToDate(store, debt, r);
  const payment = debt.min_payment_cents + Math.max(0, extraCents);

  const sim = simulatePayoff(currentBalance, r, payment, futureSpend);
  const minSim = simulatePayoff(currentBalance, r, debt.min_payment_cents, futureSpend);

  // Balance curve from now to payoff under this scenario (for the chart).
  const curveMap = new Map<string, number>();
  fillForward(currentBalance, startYM, r, payment, futureSpend, curveMap);
  const curve: DebtScenarioPoint[] = [...curveMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month_key, balance]) => ({
      month_key,
      label: monthLabel(parseYM(month_key)),
      balance,
    }));

  const payoffYM = sim.months != null ? addMonths(startYM, sim.months) : null;
  const interestSaved =
    !minSim.neverPaysOff &&
    !sim.neverPaysOff &&
    minSim.totalInterest != null &&
    sim.totalInterest != null
      ? Math.max(0, minSim.totalInterest - sim.totalInterest)
      : 0;

  return {
    extra_cents: extraCents,
    monthly_payment_cents: payment,
    future_monthly_spend_cents: futureSpend,
    payoff_month_key: payoffYM ? monthKey(payoffYM) : null,
    payoff_label: payoffYM ? monthLabel(payoffYM) : null,
    months_remaining: sim.months,
    total_interest_cents: sim.totalInterest,
    interest_saved_cents: interestSaved,
    never_pays_off: sim.neverPaysOff,
    curve,
  };
}
