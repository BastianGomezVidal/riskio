import type { CSSProperties, ReactNode } from "react";
import { LoginCard } from "./LoginCard/LoginCard";

import stormBackground from "@/assets/pictures/Kate_Storm.jpg";

const AUTH_BACKGROUND: CSSProperties = {
  backgroundImage: `linear-gradient(rgb(2 6 23 / 0.55), rgb(2 6 23 / 0.45)), url(${stormBackground})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
};

interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen flex-col" style={AUTH_BACKGROUND}>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <LoginCard>
            <h1 className="mb-6 text-center text-xl font-semibold">Riskio</h1>
            {children}
          </LoginCard>
        </div>
      </div>
      {footer && <div className="flex justify-center px-4 pb-6">{footer}</div>}
    </main>
  );
}
