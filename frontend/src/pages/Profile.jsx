import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../api/services";
import { uploadsUrl } from "../utils/uploadsUrl";
import Layout from "../components/Layout";
import Alert from "../components/Alert";
import "../styles/Profile.css";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!photo) {
      setMessage({ type: "error", text: "Please choose a photo first." });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("photo", photo);
      const { data } = await authService.updatePhoto(formData);

      const updatedUser = { ...user, profile_photo_path: data.profile_photo_path };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      setMessage({ type: "success", text: "Profile photo updated." });
      setPhoto(null);
      setPreview(null);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to update photo." });
    } finally {
      setSubmitting(false);
    }
  }

  const currentPhotoUrl = uploadsUrl(user.profile_photo_path);

  return (
    <Layout>
      <div className="page-header">
        <h2>My Profile</h2>
        <p>View your account details and update your profile photo.</p>
      </div>

      <Alert type={message?.type} message={message?.text} onClose={() => setMessage(null)} />

      <div className="profile-card">
        <div className="profile-photo-section">
          <img
            src={preview || currentPhotoUrl || "/default-avatar.svg"}
            alt={user.full_name}
            className="profile-photo-large"
          />
          <form onSubmit={handleSubmit} className="profile-photo-form">
            <label htmlFor="photo">Update Photo</label>
            <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Uploading..." : "Save Photo"}
            </button>
          </form>
        </div>

        <dl className="profile-details">
          <div><dt>Full Name</dt><dd>{user.full_name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Role</dt><dd className="capitalize">{user.role}</dd></div>
          {user.national_id && <div><dt>National ID</dt><dd>{user.national_id}</dd></div>}
          {user.phone_number && <div><dt>Phone</dt><dd>{user.phone_number}</dd></div>}
          {user.verification_status && (
            <div><dt>Verification Status</dt><dd className="capitalize">{user.verification_status}</dd></div>
          )}
        </dl>
      </div>
    </Layout>
  );
}
