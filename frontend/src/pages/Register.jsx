import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import "../styles/Auth.css";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  nationalId: "",
  phoneNumber: "",
};

export default function Register() {
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState(null);
  const [idDocument, setIdDocument] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!photo) {
      setError("Please upload a passport-size profile photo.");
      return;
    }
    if (!idDocument) {
      setError("Please upload a PDF copy of your National ID or passport.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      formData.append("photo", photo);
      formData.append("idDocument", idDocument);

      const data = await register(formData);

      navigate("/login", {
        state: {
          message:
            data?.message ||
            "Registration received. Your account is pending verification - you'll be able to log in once it's approved.",
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <span className="auth-logo">⚑</span>
          <h2>Create Your Citizen Account</h2>
          <p>
            One account for every land service - register land, buy, and sell. Your identity is
            verified once by an admin or registrar before you can log in.
          </p>
        </div>

        <Alert type="error" message={error} onClose={() => setError("")} />

        <form onSubmit={handleSubmit} className="auth-form auth-form-grid">
          <div>
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required />
          </div>

          <div>
            <label htmlFor="email">Email Address</label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>

          <div>
            <label htmlFor="nationalId">National ID Number</label>
            <input id="nationalId" name="nationalId" value={form.nationalId} onChange={handleChange} required />
          </div>

          <div>
            <label htmlFor="phoneNumber">Phone Number</label>
            <input id="phoneNumber" name="phoneNumber" value={form.phoneNumber} onChange={handleChange} required />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              minLength={6}
              required
            />
          </div>

          <div>
            <label htmlFor="photo">Passport-Size Photo</label>
            <input
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              required
            />
          </div>

          <div className="auth-form-full">
            <label htmlFor="idDocument">National ID / Passport (PDF)</label>
            <input
              id="idDocument"
              type="file"
              accept="application/pdf"
              onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
              required
            />
            <p className="field-hint">
              Used only to verify your identity before your account is approved. Reviewed by
              registry staff and never shared publicly.
            </p>
          </div>

          <button className="btn btn-primary btn-block auth-form-full" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
