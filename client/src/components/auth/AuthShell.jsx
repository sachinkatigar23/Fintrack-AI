import Logo from "../common/Logo.jsx";

// Shared frame for login / register / password pages
export default function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Logo />
        <b>
          FinTrack <i>AI</i>
        </b>
      </div>
      <div className="auth-card">{children}</div>
    </div>
  );
}
