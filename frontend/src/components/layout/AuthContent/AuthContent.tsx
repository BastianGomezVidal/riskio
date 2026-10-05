// src/components/AuthContent/AuthContent.tsx
import type { AuthMode } from "@/auth/auth-mode";
import { ExternalAuth } from "./ExternalAuth";
import { InternalAuth } from "./InternalAuth";
import { Welcome } from "./Welcome";

interface AuthContentProps {
  mode: AuthMode;
}

export function AuthContent({ mode }: AuthContentProps) {
  return (
    <section className="mt-6">
      <Welcome mode={mode} />
      <ExternalAuth />
      <InternalAuth key={mode} mode={mode} />
    </section>
  );
}
