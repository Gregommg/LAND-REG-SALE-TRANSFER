import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { uploadsUrl } from "../utils/uploadsUrl";
import "../styles/Navbar.css";

function initials(fullName) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">⚑</span>
        <div>
          <h1>Land MANAGEMENT System</h1>
          <p>Ministry of Lands and Physical Planning &mdash; Kenya</p>
        </div>
      </div>

      {user && (
        <div className="navbar-user">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <Link to="/profile" className="navbar-avatar-link" title="My Profile">
            {user.profile_photo_path ? (
              <img className="navbar-avatar" src={uploadsUrl(user.profile_photo_path)} alt={user.full_name} />
            ) : (
              <span className="navbar-avatar navbar-avatar-fallback">{initials(user.full_name)}</span>
            )}
          </Link>
          <div className="navbar-user-info">
            <span className="navbar-user-name">{user.full_name}</span>
            <span className={`role-badge role-${user.role}`}>{user.role}</span>
          </div>
          <button className="btn btn-outline" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
