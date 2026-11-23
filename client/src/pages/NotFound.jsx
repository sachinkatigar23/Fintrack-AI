import { Link } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell.jsx";

export default function NotFound() {
  return (
    <AuthShell>
      <h2>404 - Page not found</h2>
      <p className="sub">The page you're looking for doesn't exist or was moved.</p>
      <Link to="/dashboard" className="btn grad block" style={{ padding: "14px 17px" }}>
        Go to dashboard
      </Link>
    </AuthShell>
  );
}
