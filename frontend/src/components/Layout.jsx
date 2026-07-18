import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import "../styles/Layout.css";

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
