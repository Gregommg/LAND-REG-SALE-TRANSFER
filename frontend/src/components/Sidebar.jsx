import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import InstallAppButton from "./InstallAppButton";
import "../styles/Sidebar.css";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: "▤", roles: null },
  { to: "/land-search", label: "Search Land Records", icon: "🔍", roles: null },
  { to: "/land-registration", label: "Register Land", icon: "➕", roles: null },
  { to: "/land-approvals", label: "Pending Registrations", icon: "✔", roles: ["registrar", "admin"] },
  { to: "/transactions", label: "Sale & Transfer", icon: "⇄", roles: null },
  { to: "/messages", label: "Messages", icon: "💬", roles: null },
  { to: "/profile", label: "My Profile", icon: "🙍", roles: null },
  { to: "/admin/users", label: "User Management", icon: "👤", roles: ["admin", "registrar"] },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: "🛡", roles: ["admin", "auditor"] },
];

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <nav>
        <ul>
          {LINKS.filter((link) => !link.roles || link.roles.includes(user?.role)).map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
              >
                <span className="sidebar-icon">{link.icon}</span>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <InstallAppButton />
    </aside>
  );
}
