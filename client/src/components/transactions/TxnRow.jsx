import { Pencil, Trash2 } from "../common/icons.js";
import { iconFor, paymentLabel } from "../../utils/categories.js";
import { fmtDate } from "../../utils/format.js";
import { useMoney } from "../../hooks/useMoney.js";
import { fileUrl } from "../../api/axios.js";

/**
 * One income/expense line: icon, title, "category · method · date", amount, actions.
 * `type` = "income" | "expense"
 */
export default function TxnRow({ item, type, showMethod = false, onEdit, onDelete }) {
  const money = useMoney();
  const t = type || item.type;
  const classification = item.classification || (t === "income" ? item.source : item.category);
  const Icon = iconFor(t, classification);
  const income = t === "income";

  return (
    <div className="row" onClick={() => onEdit?.(item)}>
      <span
        className="avt"
        style={{
          background: income ? "var(--mint-soft)" : "var(--coral-soft)",
          color: income ? "var(--mint)" : "var(--coral)",
          border: `1px solid ${income ? "rgba(47,214,166,.18)" : "rgba(255,107,122,.18)"}`,
        }}
      >
        <Icon />
      </span>

      <div className="rt">
        <b>{item.title}</b>
        <span>
          {classification}
          {showMethod && (
            <>
              <i /> {paymentLabel(item.paymentMethod)}
            </>
          )}
          <i /> {fmtDate(item.date)}
          {item.isRecurring && <em className="faint" style={{ fontStyle: "normal" }}>· auto</em>}
        </span>
      </div>

      {item.receiptUrl && (
        <a
          className="tag sky hide-sm"
          href={fileUrl(item.receiptUrl)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open receipt"
        >
          RECEIPT
        </a>
      )}

      <span className={`amt ${income ? "pos" : "neg"}`}>{money.signed(item.amount, t)}</span>

      {(onEdit || onDelete) && (
        <div className="acts" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <button type="button" aria-label="Edit" onClick={() => onEdit(item)}>
              <Pencil />
            </button>
          )}
          {onDelete && (
            <button type="button" className="del" aria-label="Delete" onClick={() => onDelete(item)}>
              <Trash2 />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
