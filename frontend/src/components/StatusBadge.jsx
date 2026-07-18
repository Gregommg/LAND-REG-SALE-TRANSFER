import "../styles/StatusBadge.css";

export default function StatusBadge({ status }) {
  const label = status ? status.replace(/_/g, " ") : "unknown";
  return <span className={`status-badge status-${status}`}>{label}</span>;
}
