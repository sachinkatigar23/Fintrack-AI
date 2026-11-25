import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.js";
import toast from "react-hot-toast";
import AuthShell from "../components/auth/AuthShell.jsx";
import PasswordInput from "../components/auth/PasswordInput.jsx";
import { errorMessage } from "../api/axios.js";

const Register = () => {
  const navigate = useNavigate();
  const { register, loading } = useContext(AuthContext);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please provide a valid email address");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      const result = await register(name, email, password);
      if (result?.needsVerification) {
        toast.success("We've sent a 6-digit code to your email");
        navigate(`/verify-email?email=${encodeURIComponent(result.email || email)}`, {
          state: { emailEnabled: result.emailEnabled, expiresIn: result.expiresIn, retryAfter: result.retryAfter },
        });
      } else {
        toast.success("Account created successfully!");
        navigate("/dashboard");
      }
    } catch (error) {
      toast.error(errorMessage(error, "Registration failed"));
    }
  };

  return (
    <AuthShell>
      <h2>Create your account</h2>
      <p className="sub">Take control of every rupee.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {/* Name */}
        <label className="field" htmlFor="name">
          <span>Full Name</span>
          <input
            id="name"
            className="input"
            type="text"
            placeholder="Enter your name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

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
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {/* Confirm Password */}
        <label className="field" htmlFor="confirmPassword">
          <span>Confirm Password</span>
          <PasswordInput
            id="confirmPassword"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>

        {/* Register Button */}
        <button type="submit" disabled={loading} className="btn grad block" style={{ padding: "14px 17px", fontSize: 15, borderRadius: 13 }}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      {/* Login Link */}
      <p className="auth-foot">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </AuthShell>
  );
};

export default Register;
