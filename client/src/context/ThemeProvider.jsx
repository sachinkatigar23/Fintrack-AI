import { useCallback, useEffect, useState } from "react";
import { ThemeContext } from "./ThemeContext.js";
import api, { getAccessToken } from "../api/axios.js";

const KEY = "fintrack-theme";

const readSaved = () => {
  try {
    return localStorage.getItem(KEY) || "dark";
  } catch {
    return "dark";
  }
};

// Dark is the default theme. The choice is remembered in the browser and
// saved to the user's profile (darkModePref) when logged in.
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readSaved);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme !== "light");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage not available */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      if (getAccessToken()) {
        api.put("/profile/preferences", { darkModePref: next === "dark" }).catch(() => {});
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
