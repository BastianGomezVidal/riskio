import { useState } from "react";
import { ActionButton } from "@/components/shared/controls";

const CONSENT_KEY = "riskio.cookieConsent";

export type CookieConsent = "accepted" | "declined" | null;

/** Reads and persists the cookie consent choice in localStorage. */
export function useCookieConsent(): [
  CookieConsent,
  (next: Exclude<CookieConsent, null>) => void,
] {
  const [consent, setConsent] = useState<CookieConsent>(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === "accepted" || stored === "declined" ? stored : null;
  });

  function persist(next: Exclude<CookieConsent, null>) {
    localStorage.setItem(CONSENT_KEY, next);
    setConsent(next);
  }

  return [consent, persist];
}

interface CookieBannerProps {
  consent: CookieConsent;
  onConsent: (next: Exclude<CookieConsent, null>) => void;
}

export function CookieBanner({ consent, onConsent }: CookieBannerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (consent) {
    return null;
  }

  return (
    <aside
      role="dialog"
      aria-label="Cookie consent"
      className="mb-6 w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
    >
      <p className="text-sm text-gray-700">
        We use cookies to keep Riskio secure and improve your experience.
      </p>

      <button
        type="button"
        onClick={() => setDetailsOpen((open) => !open)}
        className="mt-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? "Hide details" : "Learn more"}
      </button>

      {detailsOpen && (
        <p className="mt-2 text-xs text-gray-500">
          Riskio stores only an essential session cookie so you stay signed in.
          We do not use third-party trackers or sell your data.
        </p>
      )}

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ActionButton onClick={() => onConsent("declined")}>
          Decline
        </ActionButton>
        <ActionButton variant="primary" onClick={() => onConsent("accepted")}>
          Accept
        </ActionButton>
      </div>
    </aside>
  );
}
