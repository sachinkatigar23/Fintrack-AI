import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import AuthShell from "../components/auth/AuthShell.jsx";
import api, { errorMessage } from "../api/axios.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email");
    setSending(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      toast.success(res.data.message);
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err, "Could not send reset link"));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell>
      <h2>Forgot password?</h2>
      <p className="sub">We'll email you a link to reset it.</p>
      {sent ? (
        <div className="box ok">
          <p>If an account exists for {email}, a reset link is on its way. The link is valid for 30 minutes.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn grad block" disabled={sending} style={{ padding: "14px 17px", fontSize: 15, borderRadius: 13 }}>
            {sending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      <p className="auth-foot">
        Remembered it? <Link to="/login">Back to login</Link>
      </p>
    </AuthShell>
  );
}
