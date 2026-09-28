import type { ReactNode } from "react";
import { LoginCard } from "./LoginCard/LoginCard";
import { RouteErrorBoundary } from "@/global_components/ErrorBoundary/RouteErrorBoundary";

interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ children, footer }: AuthLayoutProps) {
  return (
    <main className="auth-background flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <LoginCard>
            <h1 className="mb-6 text-center text-xl font-semibold">Riskio</h1>
            <RouteErrorBoundary compact>{children}</RouteErrorBoundary>
          </LoginCard>
        </div>
      </div>
      {footer && <div className="flex justify-center px-4 pb-6">{footer}</div>}
    </main>
  );
}
