import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import "../styles/Auth.css";

export default function Login() {
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(location.state?.message || "");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⚑</span>
          <h2>Land Registration System</h2>
          <p>Sign in to manage land registration, sale and transfer records</p>
        </div>

        <Alert type="info" message={info} onClose={() => setInfo("")} />
        <Alert type="error" message={error} onClose={() => setError("")} />

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/register">Register here</Link>
        </p>

        {*<div className="auth-demo-note">
          <strong>Demo accounts</strong> (password: <code>Password123!</code>)
          <ul>
            <li>admin@landregistry.go.ke &mdash; Administrator</li>
            <li>registrar@landregistry.go.ke &mdash; Registrar</li>
            <li>peter.mwangi@example.com &mdash; Citizen (owns land)</li>
            <li>susan.achieng@example.com &mdash; Citizen</li>
          </ul>
          <p className="field-hint">
            New sign-ups register as a plain citizen and need admin/registrar approval before they can log in.
          </p>
        </div>*}
      </div>
    </div>
  );
}
