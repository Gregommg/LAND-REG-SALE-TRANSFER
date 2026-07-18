import { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    function handleAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!installPrompt || installed) return null;

  async function handleInstall() {
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <button className="install-app-btn" onClick={handleInstall}>
      ⬇ Download App
    </button>
  );
}
