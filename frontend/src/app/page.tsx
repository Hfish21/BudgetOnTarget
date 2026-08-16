import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileJson,
  Minus,
  ShieldCheck,
  Upload,
  WifiOff,
  X,
} from "lucide-react";

const LANES = [
  {
    name: "Income",
    color: "#34d399",
    blurb:
      "What comes in. Judged as a floor — you want to be at or above the number.",
    example: "Paychecks, refunds, reimbursements",
  },
  {
    name: "Necessary",
    color: "#60a5fa",
    blurb:
      "The bills you cannot skip. Steady month to month, so a surprise here is worth a look.",
    example: "Rent, utilities, insurance, groceries",
  },
  {
    name: "Discretionary",
    color: "#a78bfa",
    blurb:
      "The spending you actually control. This is where a budget changes behavior.",
    example: "Dining out, subscriptions, shopping",
  },
  {
    name: "Anomalous",
    color: "#fbbf24",
    blurb:
      "One-offs that would distort the other lanes if you left them mixed in.",
    example: "Car repair, medical bill, flights",
  },
];

const STATUSES = [
  {
    label: "On target",
    icon: Check,
    tone: "text-emerald-400",
    ring: "border-emerald-500/30 bg-emerald-500/5",
    detail: "At or under $600. Nothing to think about.",
  },
  {
    label: "In tolerance",
    icon: Minus,
    tone: "text-amber-400",
    ring: "border-amber-500/30 bg-amber-500/5",
    detail: "Between $600 and $675. Over, but within the slack you allowed.",
  },
  {
    label: "Off target",
    icon: X,
    tone: "text-red-400",
    ring: "border-red-500/30 bg-red-500/5",
    detail: "Above $675. This is the month asking for your attention.",
  },
];

const STEPS = [
  {
    icon: Upload,
    title: "Import a CSV",
    body: "Export from your bank and drop it in. Transactions are deduplicated by content hash, so re-importing the same file — or an overlapping date range — never doubles anything up.",
  },
  {
    icon: FileJson,
    title: "Categorize once",
    body: "Rules match descriptions by substring or regex and assign a category. Every future import with that merchant is sorted before you ever see it.",
  },
  {
    icon: ShieldCheck,
    title: "Set targets and watch",
    body: "Give each category a number and a tolerance. The dashboard shows where you stand today, and Trends shows whether you are drifting month over month.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="size-7" />
          <span className="text-lg font-semibold tracking-tight">
            BudgetOnTarget
          </span>
        </div>
        <Link
          href="/app"
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          Open the app
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-12 pb-20 sm:pt-20">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <WifiOff className="size-3" />
            No account. No server. Works offline.
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Budget targets that live in your browser.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground text-pretty">
            Import your bank CSVs, set a spending target for each category, and
            see where you actually stand — today, and across the last twelve
            months. Your data never leaves your device.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#targets"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              How targets work
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/70">
            Free and open source. Nothing to install.
          </p>
        </div>
      </section>

      {/* The privacy claim, made concrete */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-14 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold">There is no server</h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              Every calculation runs as JavaScript in your own tab. There is no
              backend to send your transactions to, because there is no backend
              at all.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">You hold the file</h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              Your data saves to a{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                .budget
              </code>{" "}
              file on your disk — plain JSON you can read, back up, or delete.
              No export process to fight with later.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Nothing to sign up for</h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              No email, no password, no subscription. Open the page and start.
              Once it has loaded, it keeps working with the network off.
            </p>
          </div>
        </div>
      </section>

      {/* Targets — the core idea */}
      <section id="targets" className="mx-auto max-w-5xl scroll-mt-8 px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight">
          A target is a number plus how much slack you&apos;ll accept.
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">
          Most budgets fail because they treat $601 of groceries the same as
          $900 — both are &ldquo;over.&rdquo; One is noise; the other is a
          problem. Targets separate them.
        </p>

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Example target
          </p>
          <p className="mt-2 font-mono text-lg">
            Groceries &middot; at most{" "}
            <span className="font-semibold text-foreground">$600</span>{" "}
            &middot; tolerance{" "}
            <span className="font-semibold text-foreground">$75</span>
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {STATUSES.map((s) => (
              <div
                key={s.label}
                className={`rounded-lg border p-4 ${s.ring}`}
              >
                <div className={`flex items-center gap-2 ${s.tone}`}>
                  <s.icon className="size-4" />
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground text-pretty">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold">Three directions</h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              <span className="text-foreground">At most</span> for spending
              caps. <span className="text-foreground">At least</span> for income
              floors. <span className="text-foreground">Exactly</span> for the
              bills that should not move, like rent.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Tolerance runs both ways</h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              Upper and lower bands are set separately. You can allow yourself
              $75 of overage on groceries while treating any shortfall in income
              as immediately worth knowing about.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Scope it further</h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              Narrow a target to one person in the household, or to
              descriptions matching a pattern — so &ldquo;coffee&rdquo; can have
              its own number without needing its own category.
            </p>
          </div>
        </div>
      </section>

      {/* Lanes */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight">
            Four lanes, because not all overspending means the same thing.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">
            A $400 car repair and $400 of takeout are both $400, and treating
            them identically makes the number useless. Every target belongs to
            one lane, and the dashboard scores each lane on its own.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {LANES.map((lane) => (
              <div
                key={lane.name}
                className="rounded-xl border border-border bg-background p-5"
                style={{ borderLeftColor: lane.color, borderLeftWidth: 3 }}
              >
                <h3
                  className="text-sm font-semibold"
                  style={{ color: lane.color }}
                >
                  {lane.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground text-pretty">
                  {lane.blurb}
                </p>
                <p className="mt-3 text-xs text-muted-foreground/70">
                  {lane.example}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight">
          Getting there takes about ten minutes.
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-card">
                  <step.icon className="size-4 text-muted-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground/60">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground text-pretty">
                {step.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-sm text-muted-foreground text-pretty">
          A setup wizard walks you through all three the first time, including
          mapping your bank&apos;s column names if it isn&apos;t one of the
          formats already recognized.
        </p>
      </section>

      {/* Close */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            Find out where the money actually went.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground text-pretty">
            Bring last month&apos;s CSV and you&apos;ll have an answer before
            you finish your coffee.
          </p>
          <Link
            href="/app"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground">
          <span>BudgetOnTarget — free and open source, MIT licensed.</span>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/Hfish21/BudgetOnTarget"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <Link href="/app" className="transition-colors hover:text-foreground">
              Open the app
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
