import { createContext } from "react";

// The context object lives in its own file; the provider is in AuthProvider.jsx.
// (Keeping them separate avoids the AuthContext.js / AuthContext.jsx import
// conflict that once stopped sign-in and registration from working.)
export const AuthContext = createContext(null);
