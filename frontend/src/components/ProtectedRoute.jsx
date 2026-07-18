import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps a route so it requires authentication, and optionally restricts
 * access to a set of roles.
 * Usage: <ProtectedRoute roles={["admin","registrar"]}><Page /></ProtectedRoute>
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
