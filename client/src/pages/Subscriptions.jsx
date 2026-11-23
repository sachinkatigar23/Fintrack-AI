import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Repeat, Bell, BellOff, EyeOff, RotateCcw, ChevronDown, ChevronRight, Check } from "../components/common/icons.js";
import PageHeader from "../components/common/PageHeader.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import { subscriptionApi } from "../services/financeApi.js";
import { iconFor } from "../utils/categories.js";
import { fmtDate } from "../utils/format.js";
import { useMoney } from "../hooks/useMoney.js";
import { errorMessage } from "../api/axios.js";

const FREQ = { weekly: "WEEKLY", monthly: "MONTHLY", quarterly: "QUARTERLY", yearly: "YEARLY" };
const STATUS = { tracked: ["TRACKED", "pos"], detected: ["DETECTED", "sky"], missed: ["MISSED", "gold"] };

const renewalText = (item) => {
  if (item.status === "missed") return `No charge since ${fmtDate(item.lastDate)} – cancelled?`;
  if (item.daysUntil === 0) return "Due today";
  if (item.daysUntil < 0) return `Was due ${fmtDate(item.nextExpected)}`;
  return `Renews in ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"} · ${fmtDate(item.nextExpected)}`;
};

export default function Subscriptions() {
  const money = useMoney();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(() => {
    subscriptionApi
      .list()
      .then(setData)
      .catch((err) => toast.error(errorMessage(err, "Could not load subscriptions")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key, fn, { changed = false } = {}) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res?.message) toast.success(res.message, { duration: 5000 });
      if (changed) window.dispatchEvent(new Event("fintrack:data-changed"));
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Action failed"));
    } finally {
      setBusy("");
    }
  };

  const track = (item) => {
    const ok = window.confirm(
      `Track "${item.name}" as a recurring expense?\n\nFrom then on FinTrack records ${money.fmt0(item.lastAmount)} ${item.frequency} automatically – you won't need to add it by hand (delete manual entries to avoid counting it twice).`
    );
    if (ok) run(item.key, () => subscriptionApi.track(item.key), { changed: true });
  };

  const items = data?.items || [];
  const hidden = data?.hidden || [];
  const totals = data?.totals || {};

  return (
    <>
      <PageHeader eyebrow="PLANNING SPACE" title="Subscriptions & regular payments" description="Found automatically from your expenses." />

      {loading ? (
        <div className="grid g4" style={{ marginBottom: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 86 }} />
          ))}
        </div>
      ) : (
        items.length > 0 && (
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <div className="card card-pad">
              <div className="lbl-mono">MONTHLY COST</div>
              <div className="big-mono coral" style={{ fontSize: 24, marginTop: 8 }}>{money.fmt0(totals.monthly)}</div>
            </div>
            <div className="card card-pad">
              <div className="lbl-mono">YEARLY COST</div>
              <div className="big-mono" style={{ fontSize: 24, marginTop: 8 }}>{money.fmt0(totals.yearly)}</div>
            </div>
            <div className="card card-pad">
              <div className="lbl-mono">% OF INCOME</div>
              <div className="big-mono" style={{ fontSize: 24, marginTop: 8 }}>{totals.pctOfIncome === null || totals.pctOfIncome === undefined ? "–" : `${totals.pctOfIncome.toFixed(1)}%`}</div>
            </div>
            <div className="card card-pad">
              <div className="lbl-mono">COUNT</div>
              <div className="big-mono" style={{ fontSize: 24, marginTop: 8 }}>{totals.count || 0}</div>
            </div>
          </div>
        )
      )}

      {loading ? (
        <div className="grid g3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 190 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Repeat />}
            title="No subscriptions found yet"
            text="We look for at least 2 payments to the same merchant at a regular interval (weekly, monthly, quarterly or yearly)."
          />
        </div>
      ) : (
        <div className="grid g3">
          {items.map((item) => {
            const Icon = iconFor("expense", item.category);
            const [statusLabel, statusTone] = STATUS[item.status] || STATUS.detected;
            const pc = item.priceChange;
            return (
              <div key={item.key} className="card bcard" style={{ cursor: "default" }}>
                <div className="bt">
                  <div className="cat">
                    <span className="cic" style={{ background: "var(--sky-soft)", color: "var(--sky)" }}>
                      <Icon />
                    </span>
                    <div>
                      <div className="cn">{item.name}</div>
                      <div className="cs">
                        {item.category} · {item.kind}
                      </div>
                    </div>
                  </div>
                  <span className="tag iris">{FREQ[item.frequency]}</span>
                </div>
                <div className="flex items-end justify-between" style={{ marginBottom: 8 }}>
                  <span className="lim">{money.fmt0(item.typical)}</span>
                  <span className="faint mono" style={{ fontSize: 11.5 }}>{money.fmt0(item.yearlyCost)}/yr</span>
                </div>
                <div className="flex flex-wrap gap-2" style={{ marginBottom: 10 }}>
                  <span className={`tag ${statusTone}`}>{statusLabel}</span>
                  <span className="tag" title="How sure we are this repeats">{item.confidence.toUpperCase()} CONFIDENCE</span>
                  {pc && (
                    <span className={`tag ${pc.to > pc.from ? "neg" : "pos"}`}>
                      {money.fmt0(pc.from)} → {money.fmt0(pc.to)} ({pc.pct > 0 ? "+" : ""}
                      {Math.round(pc.pct)}%)
                    </span>
                  )}
                </div>
                <div className={`bf ${item.status === "missed" ? "gold" : ""}`} style={{ marginTop: 0 }}>
                  <span>{renewalText(item)}</span>
                </div>
                <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
                  {item.occurrences} payments · last {money.fmt0(item.lastAmount)} on {fmtDate(item.lastDate)}
                </div>
                <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
                  {item.status !== "tracked" ? (
                    <button type="button" className="btn primary sm" disabled={busy === item.key} onClick={() => track(item)} title="Create a recurring rule that records this charge automatically">
                      <Repeat /> Track as recurring
                    </button>
                  ) : (
                    <span className="faint" style={{ fontSize: 11.5, alignSelf: "center" }}>
                      <Check style={{ width: 12, height: 12, verticalAlign: -1 }} /> Recorded automatically
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={busy === item.key}
                    onClick={() => run(item.key, () => subscriptionApi.remind(item.key, !item.remind))}
                    title={item.remind ? "Turn off renewal and price-change reminders" : "Turn on reminders"}
                  >
                    {item.remind ? <Bell /> : <BellOff />} {item.remind ? "Reminders on" : "Reminders off"}
                  </button>
                  <button type="button" className="btn ghost sm" disabled={busy === item.key} onClick={() => run(item.key, () => subscriptionApi.dismiss(item.key))}>
                    <EyeOff /> Not a subscription
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && hidden.length > 0 && (
        <section className="cgroup" style={{ marginTop: 24 }}>
          <div className="cgroup-hd">
            <button type="button" className="cgroup-toggle" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? <ChevronDown /> : <ChevronRight />}
              <span className="lbl-mono">Hidden</span>
              <span className="cgroup-n">{hidden.length}</span>
            </button>
          </div>
          {showHidden && (
            <div className="card">
              {hidden.map((item) => (
                <div key={item.key} className="hist-row" style={{ padding: "12px 20px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>
                      {item.frequency} · {money.fmt0(item.typical)}
                    </div>
                  </div>
                  <button type="button" className="btn ghost sm" disabled={busy === item.key} onClick={() => run(item.key, () => subscriptionApi.restore(item.key))}>
                    <RotateCcw /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
