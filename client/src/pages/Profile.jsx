import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Camera, Moon, Sun } from "../components/common/icons.js";
import toast from "react-hot-toast";
import PageHeader from "../components/common/PageHeader.jsx";
import PasswordInput from "../components/auth/PasswordInput.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useTheme } from "../hooks/useTheme.js";
import { profileApi } from "../services/financeApi.js";
import { errorMessage, fileUrl } from "../api/axios.js";
import { fmtDate } from "../utils/format.js";

const CURRENCIES = [
  ["INR", "Indian Rupee (₹)"],
  ["USD", "US Dollar ($)"],
  ["EUR", "Euro (€)"],
  ["GBP", "British Pound (£)"],
  ["AED", "UAE Dirham"],
];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState(user?.name || "");
  const [currency, setCurrency] = useState(user?.currency || "INR");
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const fileRef = useRef(null);
  const moneyRef = useRef(null);
  const location = useLocation();
  const [moneyForm, setMoneyForm] = useState({
    openingBalance: String(user?.openingBalance ?? 0),
    salaryDay: String(user?.salaryDay ?? 1),
    safetyBuffer: String(user?.safetyBuffer ?? 0),
  });
  const [moneySaving, setMoneySaving] = useState(false);

  // /profile#money-settings (linked from Safe to spend) scrolls to the card
  useEffect(() => {
    if (location.hash === "#money-settings") moneyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  const saveMoney = async (e) => {
    e.preventDefault();
    const openingBalance = Number(moneyForm.openingBalance || 0);
    const salaryDay = Number(moneyForm.salaryDay || 1);
    const safetyBuffer = Number(moneyForm.safetyBuffer || 0);
    if (!Number.isFinite(openingBalance)) return toast.error("Starting balance must be a number");
    if (!Number.isInteger(salaryDay) || salaryDay < 1 || salaryDay > 31) return toast.error("Salary day must be between 1 and 31");
    if (!Number.isFinite(safetyBuffer) || safetyBuffer < 0) return toast.error("Safety buffer can't be negative");
    setMoneySaving(true);
    try {
      const d = await profileApi.update({ openingBalance, salaryDay, safetyBuffer });
      updateUser(d.user);
      toast.success("Money settings saved");
      window.dispatchEvent(new Event("fintrack:data-changed"));
    } catch (err) {
      toast.error(errorMessage(err, "Could not save money settings"));
    } finally {
      setMoneySaving(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await profileApi.update({ name, currency });
      updateUser(d.user);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(errorMessage(err, "Could not update profile"));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be 2 MB or smaller");
    try {
      const d = await profileApi.avatar(file);
      updateUser(d.user);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(errorMessage(err, "Could not upload photo"));
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword.length < 8) return toast.error("New password must be at least 8 characters");
    if (pw.newPassword !== pw.confirm) return toast.error("New passwords do not match");
    setPwSaving(true);
    try {
      const res = await profileApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success(res.message || "Password changed");
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      toast.error(errorMessage(err, "Could not change password"));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="ACCOUNT" title="Profile & settings" description="Your details, preferences and security." />

      <div className="grid g2" style={{ alignItems: "start" }}>
        <div className="card card-pad">
          <div className="flex items-center gap-4" style={{ marginBottom: 22 }}>
            <button type="button" className="avatar" style={{ width: 64, height: 64, borderRadius: 18, fontSize: 24, border: 0, position: "relative" }} onClick={() => fileRef.current?.click()} title="Change photo">
              {user?.avatarUrl ? <img src={fileUrl(user.avatarUrl)} alt="" style={{ borderRadius: 18 }} /> : (user?.name || "U")[0].toUpperCase()}
              <span className="iconbtn" style={{ position: "absolute", right: -8, bottom: -8, width: 26, height: 26, borderRadius: 8 }}>
                <Camera style={{ width: 13, height: 13 }} />
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
            <div>
              <b style={{ fontSize: 16 }}>{user?.name}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{user?.email}</div>
              <div className="flex gap-2" style={{ marginTop: 6 }}>
                <span className={`tag ${user?.role === "admin" ? "gold" : "iris"}`}>{(user?.role || "user").toUpperCase()}</span>
                {user?.createdAt && <span className="faint" style={{ fontSize: 11 }}>Member since {fmtDate(user.createdAt)}</span>}
              </div>
            </div>
          </div>

          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <label className="field">
              <span>Full name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Preferred currency</span>
              <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <small className="faint" style={{ fontSize: 11.5 }}>Only the symbol changes – amounts are not converted.</small>
            </label>
            <div className="field">
              <span>Theme</span>
              <button type="button" className="btn ghost" onClick={toggleTheme} style={{ justifyContent: "flex-start" }}>
                {theme === "dark" ? <Moon /> : <Sun />} {theme === "dark" ? "Dark theme" : "Light theme"} · click to switch
              </button>
            </div>
            <div>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving && <span className="spin" />} Save changes
              </button>
            </div>
          </form>
        </div>

        <div className="card card-pad" id="money-settings" ref={moneyRef} style={{ scrollMarginTop: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Money settings</h3>
          <p className="section-sub" style={{ marginBottom: 18 }}>Used by Safe to spend and your available balance.</p>
          <form onSubmit={saveMoney} className="flex flex-col gap-4">
            <label className="field">
              <span>Starting balance</span>
              <input
                className="input"
                type="number"
                step="0.01"
                value={moneyForm.openingBalance}
                onChange={(e) => setMoneyForm({ ...moneyForm, openingBalance: e.target.value })}
              />
              <small className="faint" style={{ fontSize: 11.5 }}>Money you already had when you started using FinTrack.</small>
            </label>
            <label className="field">
              <span>Salary day</span>
              <input
                className="input"
                type="number"
                min="1"
                max="31"
                step="1"
                value={moneyForm.salaryDay}
                onChange={(e) => setMoneyForm({ ...moneyForm, salaryDay: e.target.value })}
              />
              <small className="faint" style={{ fontSize: 11.5 }}>Day of the month your pay usually arrives. Used when you have no recurring income rule.</small>
            </label>
            <label className="field">
              <span>Safety buffer</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={moneyForm.safetyBuffer}
                onChange={(e) => setMoneyForm({ ...moneyForm, safetyBuffer: e.target.value })}
              />
              <small className="faint" style={{ fontSize: 11.5 }}>An amount that is never counted as spendable – your emergency cushion.</small>
            </label>
            <div>
              <button type="submit" className="btn primary" disabled={moneySaving}>
                {moneySaving && <span className="spin" />} Save money settings
              </button>
            </div>
          </form>
        </div>

        <div className="card card-pad">
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Change password</h3>
          <p className="section-sub" style={{ marginBottom: 18 }}>Use at least 8 characters.</p>
          <form onSubmit={changePassword} className="flex flex-col gap-4">
            <label className="field">
              <span>Current password</span>
              <PasswordInput value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            </label>
            <label className="field">
              <span>New password</span>
              <PasswordInput autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <PasswordInput autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </label>
            <div>
              <button type="submit" className="btn primary" disabled={pwSaving || !pw.currentPassword}>
                {pwSaving && <span className="spin" />} Update password
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
