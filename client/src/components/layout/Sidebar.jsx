import { NavLink, useNavigate } from "react-router-dom";
import { LayoutGrid, FileText, ArrowDownRight, ArrowUpRight, Clock, CreditCard, Bell, AlignLeft, Sun, LogOut, Shield, Gauge, Repeat } from "../common/icons.js";
import { useAuth } from "../../hooks/useAuth.js";

const SECTIONS = [
  {
    title: "OVERVIEW",
    links: [
      ["/dashboard", "Dashboard", LayoutGrid],
      ["/transactions", "Transactions", FileText],
      ["/expenses", "Expenses", ArrowDownRight],
      ["/income", "Income", ArrowUpRight],
    ],
  },
  {
    title: "PLANNING",
    links: [
      ["/safe-to-spend", "Safe to spend", Gauge],
      ["/budgets", "Budgets", Clock],
      ["/savings-goals", "Savings goals", CreditCard],
      ["/bills", "Bills", Bell],
      ["/recurring", "Recurring", AlignLeft],
    ],
  },
  {
    title: "ANALYSIS",
    links: [
      ["/reports", "Reports", LayoutGrid],
      ["/insights", "AI insights", Sun],
    ],
  },
];

export default function Sidebar({ streak }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const days = streak?.days || 0;
  const last7 = streak?.last7 || [false, false, false, false, false, false, false];

  const sections = user?.role === "admin"
    ? [...SECTIONS, { title: "ADMIN", links: [["/admin", "Admin panel", Shield]] }]
    : SECTIONS;

  return (
    <aside className="rail">
      <div className="rail-scroll">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="rail-hd">{section.title}</div>
          {section.links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav${isActive ? " active" : ""}`}>
              <Icon />
              <span className="t">{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
      </div>

      <div className="rail-ft">
        <div className="streak">
          <b>{days}-day logging streak</b>
          <p>{days ? "Keep adding your expenses." : "Add a record today to start."}</p>
          <div className="dots">
            {last7.map((on, i) => (
              <i key={i} className={on ? "f" : ""} />
            ))}
          </div>
        </div>
        <button
          type="button"
          className="nav mt-3 w-full"
          style={{ background: "none" }}
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
        >
          <LogOut />
          <span className="t" style={{ textAlign: "left" }}>Log out</span>
        </button>
      </div>
    </aside>
  );
}
