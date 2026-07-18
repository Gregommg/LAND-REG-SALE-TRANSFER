import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker so the browser considers this an installable
// app (see InstallAppButton for the actual "Download App" UI).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-critical: the app works fine without it, it just won't be
      // installable as a standalone app on this browser.
    });
  });
}
