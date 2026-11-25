import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import AuthShell from "../components/auth/AuthShell.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { errorMessage } from "../api/axios.js";

const LENGTH = 6;
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * /verify-email?email=… - enter the 6-digit code sent after registering (or after
 * logging in to an unverified account). On success the user is signed in.
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendOtp } = useAuth();
  const email = (params.get("email") || "").trim();
  const info = location.state || {};

  const [digits, setDigits] = useState(Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // seconds until the code expires / until "Resend" is allowed (counted down every second)
  const [expiresIn, setExpiresIn] = useState(Number.isFinite(info.expiresIn) ? info.expiresIn : 600);
  const [resendIn, setResendIn] = useState(Number.isFinite(info.retryAfter) ? info.retryAfter : 60);
  const [emailEnabled, setEmailEnabled] = useState(info.emailEnabled !== false);
  const boxes = useRef([]);

  useEffect(() => {
    const t = setInterval(() => {
      setExpiresIn((s) => Math.max(0, s - 1));
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  const submit = async (code) => {
    if (busy || code.length !== LENGTH) return;
    setBusy(true);
    setError("");
    try {
      await verifyEmail(email, code);
      toast.success("Email verified – welcome to FinTrack AI!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = errorMessage(err, "Could not verify the code");
      setError(message);
      toast.error(message);
      setDigits(Array(LENGTH).fill(""));
      setTimeout(() => boxes.current[0]?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  // Fill boxes from position i with the typed / pasted digits
  const fill = (i, value) => {
    const chars = String(value).replace(/\D/g, "").slice(0, LENGTH - i).split("");
    if (!chars.length) return;
    const next = [...digits];
    chars.forEach((c, k) => (next[i + k] = c));
    setDigits(next);
    const focusAt = Math.min(LENGTH - 1, i + chars.length);
    boxes.current[focusAt]?.focus();
    if (next.every(Boolean)) submit(next.join(""));
  };

  const onKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) next[i] = "";
      else if (i > 0) {
        next[i - 1] = "";
        boxes.current[i - 1]?.focus();
      }
      setDigits(next);
    } else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < LENGTH - 1) boxes.current[i + 1]?.focus();
    else if (e.key === "Enter") submit(digits.join(""));
  };

  const resend = async () => {
    if (resendIn > 0) return;
    try {
      const r = await resendOtp(email);
      if (typeof r.emailEnabled === "boolean") setEmailEnabled(r.emailEnabled);
      if (r.retryAfter && !r.expiresIn) {
        setResendIn(r.retryAfter);
        toast(r.message || "Please wait a moment before asking again.", { icon: "⏳" });
        return;
      }
      setResendIn(r.retryAfter || 60);
      if (Number.isFinite(r.expiresIn)) setExpiresIn(r.expiresIn);
      setError("");
      setDigits(Array(LENGTH).fill(""));
      boxes.current[0]?.focus();
      toast.success("A new code is on its way");
    } catch (err) {
      toast.error(errorMessage(err, "Could not send a new code"));
    }
  };

  if (!email) {
    return (
      <AuthShell>
        <h2>Verify your email</h2>
        <p className="sub">We couldn't tell which email to verify.</p>
        <Link to="/register" className="btn grad block" style={{ padding: "14px 17px" }}>
          Back to sign up
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h2>Check your email</h2>
      <p className="sub">
        We sent a 6-digit code to <b className="otp-email">{email}</b>
      </p>

      {!emailEnabled && (
        <div className="box info" style={{ marginBottom: 18 }}>
          <p>Email isn't configured on the server – the code is printed in the server terminal.</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(digits.join(""));
        }}
      >
        <div className="otp-boxes" onPaste={(e) => {
          e.preventDefault();
          fill(0, e.clipboardData.getData("text"));
        }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (boxes.current[i] = el)}
              className={`otp-box${error ? " err" : ""}`}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={LENGTH}
              aria-label={`Digit ${i + 1}`}
              value={d}
              disabled={busy}
              onChange={(e) => fill(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
            />
          ))}
        </div>

        <p className={`otp-timer${expiresIn === 0 ? " expired" : ""}`}>
          {expiresIn > 0 ? `Code expires in ${mmss(expiresIn)}` : "This code has expired – request a new one."}
        </p>
        {error && <p className="ferr" style={{ textAlign: "center", marginTop: 6 }}>{error}</p>}

        <button
          type="submit"
          className="btn grad block"
          disabled={busy || digits.some((x) => !x)}
          style={{ padding: "14px 17px", fontSize: 15, borderRadius: 13, marginTop: 18 }}
        >
          {busy ? "Verifying..." : "Verify email"}
        </button>
      </form>

      <div className="otp-actions">
        <button type="button" className="link" disabled={resendIn > 0} onClick={resend}>
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
        <Link to="/register" className="link">
          Use a different email
        </Link>
      </div>
    </AuthShell>
  );
}
