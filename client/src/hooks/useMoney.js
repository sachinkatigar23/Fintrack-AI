import { useMemo } from "react";
import { useAuth } from "./useAuth.js";
import { makeMoney } from "../utils/format.js";

// Currency formatters that follow the user's preferred currency (default INR)
export const useMoney = () => {
  const { user } = useAuth();
  return useMemo(() => makeMoney(user?.currency || "INR"), [user?.currency]);
};
