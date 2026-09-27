import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SettingsContent } from "@/layout/protected/settings/SettingsContent/SettingsContent";

export function SettingsPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const id = hash.replace("#", "");
    const element = document.getElementById(id);
    if (!element) return;

    // Smooth scroll into view, then focus for accessibility.
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    element.focus({ preventScroll: true });
  }, [hash]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>
      <SettingsContent />
    </div>
  );
}
