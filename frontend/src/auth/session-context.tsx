import { createContext, use, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "../api/client";
import {
  clearAccessToken,
  decodeTokenClaims,
  getAccessToken,
  hasValidSession,
  storeAccessToken,
} from "./session";

interface SessionContextValue {
  user: User | null;
  signIn: (session: Session) => void;
  signOut: () => void;
  /** Rebuild the user from the stored JWT (used after the OAuth round-trip). */
  restoreFromStoredToken: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

function userFromClaims(): User | null {
  const token = getAccessToken();
  if (!token) return null;

  const claims = decodeTokenClaims(token);
  if (!claims) return null;

  return {
    id: claims.sub ?? "",
    email: claims.email ?? "",
    role: claims.role === "admin" ? "admin" : "client",
    firstName: "",
    lastName: "",
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    hasValidSession() ? userFromClaims() : null,
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      signIn: (session: Session) => {
        storeAccessToken(session.accessToken);
        setUser(session.user);
      },
      signOut: () => {
        clearAccessToken();
        setUser(null);
      },
      restoreFromStoredToken: () => setUser(userFromClaims()),
    }),
    [user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Read the current session; throws if used outside <SessionProvider>. */
export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return context;
}