import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext.js";
import api, {
  setAccessToken,
  clearAccessToken,
} from "../api/axios.js";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore login session when the app starts
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Get a new access token using the HTTP-only refresh token
        const refreshResponse = await api.post("/auth/refresh");

        const refreshData =
          refreshResponse.data?.data ?? refreshResponse.data;

        if (!refreshData?.accessToken) {
          throw new Error("Access token not received");
        }

        setAccessToken(refreshData.accessToken);

        // Get the currently logged-in user
        const userResponse = await api.get("/auth/me");

        const userData =
          userResponse.data?.data ?? userResponse.data;

        setUser(userData?.user ?? userData);
      } catch {
        // No valid refresh session
        clearAccessToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // If the refresh token expires while using the app, sign out locally
  useEffect(() => {
    const onExpired = () => {
      clearAccessToken();
      setUser(null);
    };
    window.addEventListener("fintrack:logout", onExpired);
    return () => window.removeEventListener("fintrack:logout", onExpired);
  }, []);

  // Login
  const login = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });

      const result =
        response.data?.data ?? response.data;

      setAccessToken(result.accessToken);
      setUser(result.user);

      return result;
    } catch (err) {
      const message =
        err.response?.data?.message || "Login failed";

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Register
  const register = async (name, email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post("/auth/register", {
        name,
        email,
        password,
      });

      const result =
        response.data?.data ?? response.data;

      // New accounts verify their email first: no session yet, the page goes to /verify-email
      if (!result.needsVerification && result.accessToken) {
        setAccessToken(result.accessToken);
        setUser(result.user);
      }

      return result;
    } catch (err) {
      const message =
        err.response?.data?.message || "Registration failed";

      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Verify the email with the 6-digit code -> signed in like a login
  const verifyEmail = async (email, otp) => {
    const response = await api.post("/auth/verify-email", { email, otp });
    const result = response.data?.data ?? response.data;
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result;
  };

  // Ask for a new code (the server answers neutrally; retryAfter when throttled)
  const resendOtp = async (email) => {
    const response = await api.post("/auth/resend-otp", { email });
    return { message: response.data?.message, ...(response.data?.data || {}) };
  };

  // Logout
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      clearAccessToken();
      setUser(null);
      setError(null);
    }
  };

  // Update the stored user after a profile change
  const updateUser = useCallback((changes) => {
    setUser((current) => (current ? { ...current, ...changes } : current));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        verifyEmail,
        resendOtp,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
