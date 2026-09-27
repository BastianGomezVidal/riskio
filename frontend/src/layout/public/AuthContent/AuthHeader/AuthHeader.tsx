// src/components/AuthHeader/AuthHeader.tsx
import { Link } from "react-router-dom";
import type { AuthMode } from "@/auth/auth-mode";

interface AuthHeaderProps {
  active: AuthMode;
}

const TABS: { mode: AuthMode; to: string; label: string }[] = [
  { mode: "sign-in", to: "/", label: "Sign In" },
  { mode: "sign-up", to: "/signup", label: "Sign Up" },
];

export function AuthHeader({ active }: AuthHeaderProps) {
  return (
    <nav
      role="tablist"
      className="flex overflow-hidden rounded-lg bg-[#E4E4E4]"
      aria-label="Authentication mode"
    >
      {TABS.map((tab) => {
        const selected = active === tab.mode;
        return (
          <Link
            key={tab.mode}
            to={tab.to}
            role="tab"
            aria-selected={selected}
            aria-current={selected ? "page" : undefined}
            className={`relative flex-1 rounded-lg py-2 text-center text-xs outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${
              selected
                ? "bg-[#D4D4D4] font-semibold text-gray-900 shadow-sm"
                : "bg-[#F2F2F2] font-medium text-gray-700 hover:bg-[#E8E8E8]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}