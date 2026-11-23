// API helper functions - every page talks to the server through these.
import api from "../api/axios.js";

const data = (res) => res.data?.data ?? res.data;

export const dashboardApi = {
  get: (params) => api.get("/dashboard", { params }).then(data),
};

export const expenseApi = {
  list: (params) => api.get("/expenses", { params }).then(data),
  create: (body) => api.post("/expenses", body).then(data),
  update: (id, body) => api.put(`/expenses/${id}`, body).then(data),
  remove: (id) => api.delete(`/expenses/${id}`).then(data),
  scanReceipt: (file) => {
    const form = new FormData();
    form.append("receipt", file);
    return api.post("/expenses/scan-receipt", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  uploadReceipt: (id, file) => {
    const form = new FormData();
    form.append("receipt", file);
    return api.post(`/expenses/${id}/receipt`, form, { headers: { "Content-Type": "multipart/form-data" } }).then(data);
  },
};

export const incomeApi = {
  list: (params) => api.get("/income", { params }).then(data),
  create: (body) => api.post("/income", body).then(data),
  update: (id, body) => api.put(`/income/${id}`, body).then(data),
  remove: (id) => api.delete(`/income/${id}`).then(data),
};

export const transactionApi = {
  list: (params) => api.get("/transactions", { params }).then(data),
  exportCsv: (params) => api.get("/transactions/export", { params, responseType: "blob" }),
};

export const analyticsApi = {
  get: (period) => api.get("/analytics", { params: { period } }).then(data),
  anomalies: () => api.get("/analytics/anomalies").then(data),
  goals: () => api.get("/analytics/goals").then(data),
  budgetRecs: () => api.get("/analytics/budgets/recommend").then(data),
  applyBudgetRecs: () => api.post("/analytics/budgets/apply").then((r) => r.data),
};

export const aiApi = {
  status: () => api.get("/ai/status").then(data),
  brief: () => api.get("/ai/brief").then(data),
  recap: (params) => api.get("/ai/recap", { params }).then(data),
  chat: (message, history) => api.post("/ai/chat", { message, history }).then(data),
  simulate: (body) => api.post("/ai/simulate", body).then(data),
};

export const notificationApi = {
  list: () => api.get("/notifications").then(data),
  read: (id) => api.put(`/notifications/${id}/read`).then(data),
  readAll: () => api.put("/notifications/read-all").then(data),
};

export const profileApi = {
  update: (body) => api.put("/profile", body).then(data),
  avatar: (file) => {
    const form = new FormData();
    form.append("avatar", file);
    return api.post("/profile/avatar", form, { headers: { "Content-Type": "multipart/form-data" } }).then(data);
  },
  changePassword: (body) => api.put("/auth/change-password", body).then((r) => r.data),
};

export const adminApi = {
  stats: () => api.get("/admin/stats").then(data),
  users: (search) => api.get("/admin/users", { params: { search } }).then(data),
  setRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  setBlocked: (id, blocked) => api.put(`/admin/users/${id}/block`, { blocked }).then((r) => r.data),
  remove: (id) => api.delete(`/admin/users/${id}`).then((r) => r.data),
};

// Generic CRUD for the planning pages (budgets, goals, bills, recurring)
export const collectionApi = (endpoint) => ({
  list: (params) => api.get(endpoint, { params }).then(data),
  create: (body) => api.post(endpoint, body).then(data),
  update: (id, body) => api.put(`${endpoint}/${id}`, body).then(data),
  remove: (id) => api.delete(`${endpoint}/${id}`).then(data),
  action: (id, action, body = {}) => api.post(`${endpoint}/${id}/${action}`, body).then(data),
});

export const planningApi = {
  safeToSpend: () => api.get("/planning/safe-to-spend").then(data),
  afford: (body) => api.post("/planning/afford", body).then(data),
};

export const subscriptionApi = {
  list: () => api.get("/subscriptions").then(data),
  dismiss: (key) => api.post("/subscriptions/dismiss", { key }).then((r) => r.data),
  restore: (key) => api.post("/subscriptions/restore", { key }).then((r) => r.data),
  track: (key) => api.post("/subscriptions/track", { key }).then((r) => r.data),
  remind: (key, remind) => api.post("/subscriptions/remind", { key, remind }).then((r) => r.data),
};
