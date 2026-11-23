import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext.js";

const ProtectedRoute = () => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  // Wait until authentication status is checked
  if (loading && !user) {
    return (
      <div className="auth-page">
        <div className="text-center">
          <div className="spin dark mx-auto mb-4" style={{ width: 34, height: 34, borderWidth: 3 }} />
          <p className="muted">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // User is not logged in
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // User is authenticated
  return <Outlet />;
};

export default ProtectedRoute;
