import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Clock, CreditCard, AlignLeft, Sparkles, Info, Receipt } from "../common/icons.js";
import { notificationApi } from "../../services/financeApi.js";
import { timeAgo } from "../../utils/format.js";

const STYLE = {
  budget: [Clock, "var(--coral)", "var(--coral-soft)"],
  bill: [Receipt, "var(--gold)", "var(--gold-soft)"],
  recurring: [AlignLeft, "var(--sky)", "var(--sky-soft)"],
  goal: [CreditCard, "var(--mint)", "var(--mint-soft)"],
  ai: [Sparkles, "#A99BFF", "var(--iris-soft)"],
  system: [Info, "#A99BFF", "var(--iris-soft)"],
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    notificationApi
      .list()
      .then((d) => {
        setItems(d.records || []);
        setUnread(d.unread || 0);
      })
      .catch(() => {});
  }, []);

  // Load now, then check every minute; also refresh when other pages change data
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    window.addEventListener("fintrack:data-changed", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("fintrack:data-changed", load);
    };
  }, [load]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openItem = async (n) => {
    if (!n.read) {
      await notificationApi.read(n._id).catch(() => {});
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const readAll = async () => {
    await notificationApi.readAll().catch(() => {});
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="iconbtn" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <Bell />
        {unread > 0 && <span className="badge-count">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="menu wide">
          <div className="menu-hd">
            <b>Notifications</b>
            {unread > 0 && (
              <button type="button" onClick={readAll}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="scrollY" style={{ maxHeight: 380 }}>
            {items.length === 0 && <p className="faint" style={{ padding: 18, fontSize: 13 }}>You're all caught up.</p>}
            {items.map((n) => {
              const [Icon, color, bg] = STYLE[n.type] || STYLE.system;
              return (
                <div key={n._id} className={`notif${n.read ? "" : " unread"}`} onClick={() => openItem(n)}>
                  <span className="nic" style={{ color, background: bg }}>
                    <Icon />
                  </span>
                  <div>
                    <b>{n.title}</b>
                    <p>{n.message}</p>
                    <time>{timeAgo(n.createdAt)}</time>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
