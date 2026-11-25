import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Topbar from "../components/layout/Topbar.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import { streakApi } from "../services/financeApi.js";

// Application shell: top bar + sidebar + scrollable page area
export default function AppLayout() {
  const location = useLocation();
  const [streak, setStreak] = useState(null);

  const loadStreak = useCallback(() => {
    streakApi.get().then(setStreak).catch(() => {});
  }, []);

  useEffect(() => {
    loadStreak();
    window.addEventListener("fintrack:data-changed", loadStreak);
    return () => window.removeEventListener("fintrack:data-changed", loadStreak);
  }, [loadStreak]);

  return (
    <>
      <div className="backdrop" />
      <div className="app">
        <Topbar />
        <Sidebar streak={streak} />
        <main className="main" id="main">
          <motion.div
            key={location.pathname}
            className="page"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </>
  );
}
