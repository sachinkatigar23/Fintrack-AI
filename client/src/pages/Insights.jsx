import { useSearchParams } from "react-router-dom";
import { Sparkles, AlertTriangle, Target, Lightbulb, MessageSquare, LineChart } from "../components/common/icons.js";
import PageHeader from "../components/common/PageHeader.jsx";
import HealthTab from "../components/insights/HealthTab.jsx";
import AnomaliesTab from "../components/insights/AnomaliesTab.jsx";
import GoalPlannerTab from "../components/insights/GoalPlannerTab.jsx";
import SmartBudgetsTab from "../components/insights/SmartBudgetsTab.jsx";
import RecapTab from "../components/insights/RecapTab.jsx";
import CoachTab from "../components/insights/CoachTab.jsx";
import SimulatorTab from "../components/insights/SimulatorTab.jsx";

const TABS = [
  ["overview", "Health Overview", Sparkles, HealthTab],
  ["anomalies", "Anomalies", AlertTriangle, AnomaliesTab],
  ["goals", "Goal Planner", Target, GoalPlannerTab],
  ["budgets", "Smart Budgets", Lightbulb, SmartBudgetsTab],
  ["recap", "Monthly Recap", Sparkles, RecapTab],
  ["chat", "Ask Coach", MessageSquare, CoachTab],
  ["simulate", "Simulator", LineChart, SimulatorTab],
];

export default function Insights() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find(([id]) => id === params.get("tab")) ? params.get("tab") : "overview";
  const Active = TABS.find(([id]) => id === tab)[3];

  return (
    <>
      <PageHeader eyebrow="INTELLIGENCE" title="AI Insights" description="Your personalized financial intelligence layer." />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="tabsbar" role="tablist">
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`tabp${tab === id ? " on" : ""}`}
              onClick={() => setParams({ tab: id }, { replace: true })}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>
      </div>

      <Active key={tab} />
    </>
  );
}
