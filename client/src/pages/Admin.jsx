import { useCallback, useEffect, useState } from "react";
import { Search, Shield, Ban, Trash2, UserCheck, Users, Activity, FileText } from "../components/common/icons.js";
import toast from "react-hot-toast";
import PageHeader from "../components/common/PageHeader.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import { adminApi } from "../services/financeApi.js";
import { useAuth } from "../hooks/useAuth.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { useMoney } from "../hooks/useMoney.js";
import { errorMessage } from "../api/axios.js";
import { fmtDate, timeAgo } from "../utils/format.js";

export default function Admin() {
  const { user: me } = useAuth();
  const money = useMoney();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState("");
  const q = useDebounce(search);

  const loadUsers = useCallback(() => {
    adminApi.users(q).then((d) => setUsers(d.users)).catch((err) => toast.error(errorMessage(err, "Could not load users")));
  }, [q]);

  useEffect(() => {
    adminApi.stats().then(setStats).catch((err) => toast.error(errorMessage(err, "Could not load stats")));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const run = async (fn, okMsg) => {
    try {
      const res = await fn();
      toast.success(res?.message || okMsg);
      loadUsers();
      adminApi.stats().then(setStats).catch(() => {});
    } catch (err) {
      toast.error(errorMessage(err, "Action failed"));
    }
  };

  const tiles = stats
    ? [
        ["REGISTERED USERS", stats.users, Users, `${stats.newUsers30} new in 30 days`],
        ["ACTIVE (30 DAYS)", stats.active30, Activity, `${stats.admins} admin · ${stats.blocked} blocked`],
        ["TRANSACTIONS", stats.transactions, FileText, "All users, all time"],
        ["VOLUME TRACKED", money.fmt0(stats.incomeVolume + stats.expenseVolume), Shield, "Income + expenses (aggregate)"],
      ]
    : [];

  return (
    <>
      <PageHeader eyebrow="ADMINISTRATION" title="Admin panel" description="Platform statistics and user management. Aggregate figures only." />

      <div className="tiles4">
        {!stats && [1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 120 }} />)}
        {tiles.map(([label, value, Icon, foot]) => (
          <div key={label} className="card card-pad">
            <div className="flex items-center justify-between">
              <span className="lbl-mono" style={{ color: "var(--text-2)" }}>{label}</span>
              <Icon style={{ width: 16, height: 16 }} className="iris" />
            </div>
            <div className="big-mono" style={{ fontSize: 28, margin: "12px 0 6px" }}>{value}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{foot}</div>
          </div>
        ))}
      </div>

      <div className="split-r" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-hd">
            <h3>Users</h3>
            <span className="sub">{users?.length ?? 0} SHOWN</span>
            <div style={{ flex: 1 }} />
            <div className="searchbar" style={{ width: 240 }}>
              <Search />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" />
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>ROLE</th>
                  <th>STATUS</th>
                  <th>VERIFIED</th>
                  <th>RECORDS</th>
                  <th>JOINED</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {(users || []).map((u) => {
                  const self = String(u._id) === String(me?._id || me?.id);
                  return (
                    <tr key={u._id} style={{ cursor: "default" }}>
                      <td>
                        <b style={{ fontWeight: 600 }}>{u.name}</b>
                        <div className="faint" style={{ fontSize: 11.5 }}>{u.email}</div>
                      </td>
                      <td>
                        <span className={`tag ${u.role === "admin" ? "gold" : "iris"}`}>{u.role.toUpperCase()}</span>
                      </td>
                      <td>
                        <span className={`tag ${u.isBlocked ? "neg" : "pos"}`}>{u.isBlocked ? "BLOCKED" : "ACTIVE"}</span>
                      </td>
                      <td>
                        <span className={`tag ${u.emailVerified === false ? "gold" : "pos"}`}>{u.emailVerified === false ? "UNVERIFIED" : "VERIFIED"}</span>
                      </td>
                      <td className="mono">{u.records}</td>
                      <td className="faint">{fmtDate(u.createdAt)}</td>
                      <td>
                        {self ? (
                          <span className="faint" style={{ fontSize: 11.5, display: "block", textAlign: "right" }}>You</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button type="button" className="btn ghost sm" title={u.role === "admin" ? "Make user" : "Make admin"} onClick={() => run(() => adminApi.setRole(u._id, u.role === "admin" ? "user" : "admin"), "Role updated")}>
                              <Shield /> {u.role === "admin" ? "Demote" : "Make admin"}
                            </button>
                            <button type="button" className="btn ghost sm" title={u.isBlocked ? "Unblock" : "Block"} onClick={() => run(() => adminApi.setBlocked(u._id, !u.isBlocked), "Updated")}>
                              {u.isBlocked ? <UserCheck /> : <Ban />} {u.isBlocked ? "Unblock" : "Block"}
                            </button>
                            <button
                              type="button"
                              className="btn danger sm"
                              title="Delete user"
                              onClick={() => window.confirm(`Delete ${u.email} and ALL their data? This cannot be undone.`) && run(() => adminApi.remove(u._id), "User deleted")}
                            >
                              <Trash2 />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <h3>Recent activity</h3>
          </div>
          <div className="card-bd flex flex-col gap-3" style={{ paddingTop: 14 }}>
            {(stats?.recentActivity || []).length === 0 && <p className="faint" style={{ fontSize: 12.5 }}>No activity yet.</p>}
            {(stats?.recentActivity || []).map((a, i) => (
              <div key={i} className="dotline" style={{ fontSize: 12.5 }}>
                <i style={{ background: a.action.startsWith("admin") ? "var(--gold)" : "var(--iris)" }} />
                <div>
                  <b style={{ fontWeight: 600 }}>{a.action}</b> <span className="muted">· {a.user}</span>
                  <div className="faint" style={{ fontSize: 10.5 }}>{timeAgo(a.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
