import "../styles/Alert.css";

export default function Alert({ type = "info", message, onClose }) {
  if (!message) return null;

  return (
    <div className={`alert alert-${type}`}>
      <span>{message}</span>
      {onClose && (
        <button className="alert-close" onClick={onClose} aria-label="Dismiss">
          &times;
        </button>
      )}
    </div>
  );
}
