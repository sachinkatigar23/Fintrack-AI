import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.js";
import toast from "react-hot-toast";
import AuthShell from "../components/auth/AuthShell.jsx";
import PasswordInput from "../components/auth/PasswordInput.jsx";
import { errorMessage } from "../api/axios.js";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    try {
      await login(email, password);
      toast.success("Login successful!");
      // Go back to the page the user originally wanted, or the dashboard
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, "Invalid email or password"));
    }
  };

  return (
    <AuthShell>
      <h2>Welcome back</h2>
      <p className="sub">Smarter spending starts here.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {/* Email */}
        <label className="field" htmlFor="email">
          <span>Email</span>
          <input
            id="email"
            className="input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {/* Password */}
        <label className="field" htmlFor="password">
          <span>Password</span>
          <PasswordInput
            id="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <div className="text-right" style={{ marginTop: -6 }}>
          <Link to="/forgot-password" className="link" style={{ fontSize: 12.5, fontWeight: 500 }}>
            Forgot password?
          </Link>
        </div>

        {/* Login Button */}
        <button type="submit" disabled={loading} className="btn grad block" style={{ padding: "14px 17px", fontSize: 15, borderRadius: 13 }}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      {/* Register */}
      <p className="auth-foot">
        Don't have an account? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
};

export default Login;
