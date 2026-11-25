import { useState } from "react";
import { Flame, Check, Plus } from "../common/icons.js";
import TransactionForm from "../transactions/TransactionForm.jsx";

const MESSAGE = {
  active: "Logged today ✓ – see you tomorrow",
  at_risk: "Log something today to keep your streak",
  broken: "Streak ended – log today to start again",
  new: "Log your first record to start a streak",
};

/**
 * Logging streak in the sidebar.
 * streak = GET /streak: { current, best, status, loggedToday, last7, nextMilestone, daysToNext }
 * On a collapsed (narrow) rail only the flame and the number show.
 */
export default function StreakCard({ streak }) {
  const [logOpen, setLogOpen] = useState(false);
  const s = streak || { current: 0, best: 0, status: "new", loggedToday: false, last7: [], nextMilestone: 3, daysToNext: 3 };
  const status = s.status || "new";
  const pct = s.nextMilestone ? Math.min(100, Math.round((s.current / s.nextMilestone) * 100)) : 100;

  return (
    <>
      {/* collapsed rail: flame + number */}
      <div className={`streak-mini s-${status}`} title={`${s.current}-day streak · ${MESSAGE[status]}`}>
        <Flame />
        <b>{s.current}</b>
      </div>

      <div className={`streak-card s-${status}`}>
        <div className="sc-top">
          <span className="sc-flame">
            <Flame />
          </span>
          <b className="sc-num">{s.current}-day streak</b>
          <span className="sc-best">Best: {s.best} day{s.best === 1 ? "" : "s"}</span>
        </div>

        <div className="sc-days">
          {(s.last7 || []).map((d) => (
            <div key={d.date} className="sc-day" title={d.date}>
              <span className={`sc-pill${d.logged ? " on" : ""}${d.isToday ? " today" : ""}${d.isToday && !d.logged ? " waiting" : ""}`}>
                {d.logged && <Check />}
              </span>
              <i>{d.label}</i>
            </div>
          ))}
        </div>

        <p className="sc-msg">{MESSAGE[status]}</p>

        {s.nextMilestone && (
          <div className="sc-next">
            <span>
              {s.daysToNext} day{s.daysToNext === 1 ? "" : "s"} to your {s.nextMilestone}-day badge
            </span>
            <div className="sc-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {!s.loggedToday && (
          <button type="button" className="btn primary sm sc-log" onClick={() => setLogOpen(true)}>
            <Plus /> Log now
          </button>
        )}
      </div>

      <TransactionForm open={logOpen} onClose={() => setLogOpen(false)} type="expense" focusQuickAdd />
    </>
  );
}
