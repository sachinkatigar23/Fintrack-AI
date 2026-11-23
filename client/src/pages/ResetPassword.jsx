import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import AuthShell from "../components/auth/AuthShell.jsx";
import PasswordInput from "../components/auth/PasswordInput.jsx";
import api, { errorMessage } from "../api/axios.js";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setSaving(true);
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      toast.success(res.data.message);
      navigate("/login");
    } catch (err) {
      toast.error(errorMessage(err, "Could not reset password"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell>
      <h2>Set a new password</h2>
      <p className="sub">Choose a strong password you haven't used before.</p>
      {!token ? (
        <div className="box bad">
          <p>This reset link is incomplete. Please request a new one.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <label className="field">
            <span>New password</span>
            <PasswordInput placeholder="At least 8 characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <PasswordInput placeholder="Re-enter your password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <button className="btn grad block" disabled={saving} style={{ padding: "14px 17px", fontSize: 15, borderRadius: 13 }}>
            {saving ? "Saving..." : "Update password"}
          </button>
        </form>
      )}
      <p className="auth-foot">
        <Link to="/forgot-password">Request a new link</Link>
      </p>
    </AuthShell>
  );
}
