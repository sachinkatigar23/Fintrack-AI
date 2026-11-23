import { Pause, Play } from "../components/common/icons.js";
import CollectionPage from "../components/planning/CollectionPage.jsx";
import { EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS, iconFor } from "../utils/categories.js";
import { fmtDate, toInputDate } from "../utils/format.js";
import { useMoney } from "../hooks/useMoney.js";

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
  {
    name: "frequency",
    label: "Frequency",
    default: "monthly",
    options: [
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
      ["yearly", "Yearly"],
    ],
  },
  { name: "nextDate", label: "Next date", type: "date", default: () => toInputDate() },
  { name: "paymentMethod", label: "Payment method", default: "upi", options: PAYMENT_METHODS, full: true },
];

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
        paymentMethod: r.paymentMethod,
      })}
      renderCard={(r, helpers) => {
        const Icon = iconFor(r.type, r.classification);
        const income = r.type === "income";
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
              <span className={`tag ${r.active ? "pos" : "gold"}`}>{r.active ? "ACTIVE" : "PAUSED"}</span>
            </div>
            <div className="bf" style={{ marginTop: 0 }}>
              <span>{r.active ? `Next run ${fmtDate(r.nextDate)}` : "Paused - nothing will be added"}</span>
            </div>
            <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => helpers.update(r, { active: !r.active }, r.active ? "Paused" : "Resumed")}
              >
                {r.active ? <Pause /> : <Play />} {r.active ? "Pause" : "Resume"}
              </button>
            </div>
          </>
        );
      }}
    />
  );
}
