import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Sun, Moon, User, Shield, LogOut } from "../common/icons.js";
import Logo from "../common/Logo.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { useTheme } from "../../hooks/useTheme.js";
import { fileUrl } from "../../api/axios.js";

export default function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  // Ctrl+K / Cmd+K focuses the global search box
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", close);
    };
  }, []);

  const search = (e) => {
    e.preventDefault();
    navigate(`/transactions?search=${encodeURIComponent(q.trim())}`);
    setQ("");
    inputRef.current?.blur();
  };

  const initial = (user?.name || "U").trim()[0].toUpperCase();

  return (
    <header className="topbar">
      <Link to="/dashboard" className="brand">
        <div className="logo">
          <Logo />
        </div>
        <b>
          FinTrack <i>AI</i>
        </b>
      </Link>

      <form className="searchbar" onSubmit={search} role="search">
        <Search />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search transactions, budgets, goals"
          aria-label="Search transactions"
        />
        <span className="kbd">⌘K</span>
      </form>

      <div className="topbar-sp" />

      <button type="button" className="iconbtn" onClick={toggleTheme} aria-label="Toggle theme" title="Switch theme">
        {theme === "dark" ? <Sun /> : <Moon />}
      </button>

      <NotificationBell />

      <div className="relative" ref={menuRef}>
        <button type="button" className="avatar" style={{ border: 0 }} onClick={() => setMenu((v) => !v)} aria-label="Account menu">
          {user?.avatarUrl ? <img src={fileUrl(user.avatarUrl)} alt="" /> : initial}
        </button>
        {menu && (
          <div className="menu">
            <div className="menu-user">
              <b>{user?.name}</b>
              <span>{user?.email}</span>
            </div>
            <button type="button" className="menu-item" onClick={() => { setMenu(false); navigate("/profile"); }}>
              <User /> Profile & settings
            </button>
            {user?.role === "admin" && (
              <button type="button" className="menu-item" onClick={() => { setMenu(false); navigate("/admin"); }}>
                <Shield /> Admin panel
              </button>
            )}
            <button
              type="button"
              className="menu-item"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              <LogOut /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
