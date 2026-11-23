import axios from "axios";

let accessToken = null;

// Store access token in memory
export const setAccessToken = (token) => {
  accessToken = token;
};

// Clear access token
export const clearAccessToken = () => {
  accessToken = null;
};

// Get current access token
export const getAccessToken = () => {
  return accessToken;
};

// API address comes from client/.env (VITE_API_URL)
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

// Server origin, used to show uploaded files stored on the server (/uploads/...)
export const SERVER_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

export const fileUrl = (url) => {
  if (!url) return "";
  return url.startsWith("/") ? `${SERVER_ORIGIN}${url}` : url;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach access token to protected requests
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Only one refresh request at a time, even if many calls fail together
let refreshPromise = null;

// Automatically refresh access token when it expires
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // If access token expired
    // and this request has not already been retried
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register")
    ) {
      originalRequest._retry = true;

      try {
        // Refresh token is automatically sent as HTTP-only cookie
        refreshPromise = refreshPromise || api.post("/auth/refresh");
        const response = await refreshPromise;

        const result = response.data?.data ?? response.data;

        // Save new access token
        setAccessToken(result.accessToken);

        // Retry original request
        originalRequest.headers.Authorization =
          `Bearer ${result.accessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        clearAccessToken();

        // Session is over - send the user to the login page
        if (!window.location.pathname.startsWith("/login")) {
          window.dispatchEvent(new Event("fintrack:logout"));
        }

        return Promise.reject(refreshError);
      } finally {
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  }
);

// Friendly error text for toasts
export const errorMessage = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message ||
  (err?.code === "ERR_NETWORK" ? "Cannot reach the server. Is the backend running on port 5000?" : null) ||
  fallback;

export default api;
