import { Pause, Play, SkipForward } from "../components/common/icons.js";
import CollectionPage from "../components/planning/CollectionPage.jsx";
import { EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS, iconFor } from "../utils/categories.js";
import { fmtDate, toInputDate } from "../utils/format.js";
import { addPeriod } from "../utils/schedule.js";
import { useMoney } from "../hooks/useMoney.js";

const FREQUENCIES = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["yearly", "Yearly"],
];

// "After N payments" -> the date of the Nth payment
const endFromCount = (f) => {
  const n = Math.floor(Number(f.endCount));
  if (!f.nextDate || !n || n < 1) return "";
  const start = new Date(`${f.nextDate}T00:00:00`);
  return toInputDate(addPeriod(start, f.frequency, start.getDate(), n - 1));
};

const fields = [
  { name: "title", label: "Title", hint: "e.g. Netflix subscription", full: true },
  { name: "amount", label: "Amount", type: "number", hint: "e.g. 199" },
  {
    name: "type",
    label: "Type",
    default: "expense",
    options: [
      ["expense", "Expense"],
      ["income", "Income"],
    ],
    // switching the type resets the category / source list
    onChange: (value) => ({ classification: value === "income" ? "Salary" : "Bills & Utilities" }),
  },
  {
    name: "classification",
    label: "Category or source",
    default: "Bills & Utilities",
    options: (form) => (form.type === "income" ? INCOME_SOURCES : EXPENSE_CATEGORIES),
  },
  { name: "frequency", label: "Frequency", default: "monthly", options: FREQUENCIES },
  { name: "nextDate", label: "Next date", type: "date", default: () => toInputDate() },
  {
    name: "endMode",
    label: "Ends",
    default: "never",
    options: [
      ["never", "Never"],
      ["date", "On date"],
      ["count", "After N payments"],
    ],
  },
  { name: "endDate", label: "End date", type: "date", show: (f) => f.endMode === "date", min: (f) => f.nextDate || undefined },
  {
    name: "endCount",
    label: "Number of payments",
    type: "number",
    step: "1",
    min: "1",
    hint: "e.g. 6",
    show: (f) => f.endMode === "count",
    help: (f) => {
      const end = endFromCount(f);
      return end ? `Last payment on ${fmtDate(end)}` : "";
    },
  },
  { name: "paymentMethod", label: "Payment method", default: "upi", options: PAYMENT_METHODS, full: true },
];

const ended = (r) => !r.active && Boolean(r.completedAt);

export default function Recurring() {
  const money = useMoney();
  return (
    <CollectionPage
      title="Recurring transactions"
      singular="Recurring transaction"
      description="Manage regular income and expenses."
      endpoint="/recurring-transactions"
      fields={fields}
      toForm={(r) => ({
        title: r.title,
        amount: r.amount,
        type: r.type,
        classification: r.classification,
        frequency: r.frequency,
        nextDate: toInputDate(r.nextDate),
        endMode: r.endDate ? "date" : "never",
        endDate: r.endDate ? toInputDate(r.endDate) : "",
        endCount: "",
        paymentMethod: r.paymentMethod,
      })}
      validateForm={(f) => {
        if (f.endMode === "date" && f.endDate && f.endDate < f.nextDate) return "End date can't be before the next date";
        if (f.endMode === "count" && !(Math.floor(Number(f.endCount)) >= 1)) return "Enter how many payments (1 or more)";
        return null;
      }}
      fromForm={(f) => {
        const { endMode, endCount, ...rest } = f;
        const endDate = endMode === "date" ? f.endDate : endMode === "count" ? endFromCount(f) : "";
        return { ...rest, endDate };
      }}
      renderSummary={(meta) => {
        const s = meta.summary || {};
        return (
          <div className="grid g3" style={{ marginBottom: 16 }}>
            <div className="card card-pad">
              <div className="lbl-mono">MONTHLY RECURRING INCOME</div>
              <div className="big-mono mint" style={{ fontSize: 24, marginTop: 8 }}>{money.fmt0(s.monthlyIncome)}</div>
            </div>
            <div className="card card-pad">
              <div className="lbl-mono">MONTHLY RECURRING EXPENSES</div>
              <div className="big-mono coral" style={{ fontSize: 24, marginTop: 8 }}>{money.fmt0(s.monthlyExpenses)}</div>
            </div>
            <div className="card card-pad">
              <div className="lbl-mono">NET PER MONTH</div>
              <div className={`big-mono ${s.net < 0 ? "coral" : "mint"}`} style={{ fontSize: 24, marginTop: 8 }}>{money.fmt0(s.net)}</div>
            </div>
          </div>
        );
      }}
      renderCard={(r, helpers) => {
        const Icon = iconFor(r.type, r.classification);
        const income = r.type === "income";
        const isEnded = ended(r);
        return (
          <>
            <div className="bt">
              <div className="cat">
                <span
                  className="cic"
                  style={{ background: income ? "var(--mint-soft)" : "var(--coral-soft)", color: income ? "var(--mint)" : "var(--coral)" }}
                >
                  <Icon />
                </span>
                <div>
                  <div className="cn">{r.title}</div>
                  <div className="cs">
                    {r.classification} · {r.frequency}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between" style={{ marginBottom: 10 }}>
              <span className={`lim ${income ? "mint" : "coral"}`}>{money.signed(r.amount, r.type)}</span>
              <span className="flex gap-2">
                {!isEnded && r.endDate && <span className="tag sky">ENDS {fmtDate(r.endDate).toUpperCase()}</span>}
                {isEnded ? (
                  <span className="tag iris">ENDED</span>
                ) : (
                  <span className={`tag ${r.active ? "pos" : "gold"}`}>{r.active ? "ACTIVE" : "PAUSED"}</span>
                )}
              </span>
            </div>
            <div className="bf" style={{ marginTop: 0 }}>
              <span>
                {isEnded
                  ? `Finished ${fmtDate(r.completedAt)}`
                  : r.active
                    ? `Next run ${fmtDate(r.nextDate)}`
                    : "Paused - nothing will be added"}
              </span>
            </div>
            {!isEnded && (
              <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => helpers.update(r, { active: !r.active }, r.active ? "Paused" : "Resumed")}
                >
                  {r.active ? <Pause /> : <Play />} {r.active ? "Pause" : "Resume"}
                </button>
                {r.active && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    title="Move the next date forward one period without recording anything"
                    onClick={() =>
                      helpers.action(r, "skip", {}, (res) =>
                        res?.record && !res.record.active
                          ? "Skipped – that was the last payment, so the rule has ended"
                          : `Skipped. Next run ${fmtDate(res?.record?.nextDate)}`
                      )
                    }
                  >
                    <SkipForward /> Skip next
                  </button>
                )}
              </div>
            )}
          </>
        );
      }}
    />
  );
}
