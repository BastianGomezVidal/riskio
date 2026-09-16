import type { AuthMode } from "../../auth/auth-mode";

interface WelcomeProps {
  mode: AuthMode;
}

export function Welcome({ mode }: WelcomeProps) {
  const isSignIn = mode === "sign-in";

  return (
    <div>
      <h2 className="text-lg font-semibold">
        {isSignIn ? "Welcome back" : "Create your account"}
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        {isSignIn
          ? "Sign in to your account to continue."
          : "Start tracking storms with Riskio."}
      </p>
    </div>
  );
}