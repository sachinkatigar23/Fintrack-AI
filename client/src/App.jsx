import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import AdminRoute from "./components/common/AdminRoute.jsx";
import PublicOnlyRoute from "./components/common/PublicOnlyRoute.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import LoginPage from "./pages/Login.jsx";
import RegisterPage from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Transactions from "./pages/Transactions.jsx";
import Expenses from "./pages/Expenses.jsx";
import Income from "./pages/Income.jsx";
import Budgets from "./pages/Budgets.jsx";
import SavingsGoals from "./pages/SavingsGoals.jsx";
import Bills from "./pages/Bills.jsx";
import Recurring from "./pages/Recurring.jsx";
import SafeToSpend from "./pages/SafeToSpend.jsx";
import Reports from "./pages/Reports.jsx";
import Insights from "./pages/Insights.jsx";
import Profile from "./pages/Profile.jsx";
import Admin from "./pages/Admin.jsx";
import NotFound from "./pages/NotFound.jsx";

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/income" element={<Income />} />
          <Route path="/safe-to-spend" element={<SafeToSpend />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/savings-goals" element={<SavingsGoals />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/profile" element={<Profile />} />

          {/* Admin only */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
