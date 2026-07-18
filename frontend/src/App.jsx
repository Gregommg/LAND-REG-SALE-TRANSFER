import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LandSearch from "./pages/LandSearch";
import LandRegistration from "./pages/LandRegistration";
import LandApprovals from "./pages/LandApprovals";
import Transactions from "./pages/Transactions";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";
import TitleDeed from "./pages/TitleDeed";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";

import "./styles/App.css";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/land-search"
              element={
                <ProtectedRoute>
                  <LandSearch />
                </ProtectedRoute>
              }
            />

            <Route
              path="/land-registration"
              element={
                <ProtectedRoute>
                  <LandRegistration />
                </ProtectedRoute>
              }
            />

            <Route
              path="/land-approvals"
              element={
                <ProtectedRoute roles={["registrar", "admin"]}>
                  <LandApprovals />
                </ProtectedRoute>
              }
            />

            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              }
            />

            <Route
              path="/land/:id/title-deed"
              element={
                <ProtectedRoute>
                  <TitleDeed />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />

            <Route
              path="/messages/:userId"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute roles={["admin", "registrar"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute roles={["admin", "auditor"]}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
