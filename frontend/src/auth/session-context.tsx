import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import type { Session } from "@/domain/auth";
import type { User } from "@/domain/users";
import { queryKeys, meQuery } from "@/data/queries";
import { setUnauthorizedHandler } from "@/api/client";
import { useInactivityLogout } from "./use-inactivity-logout";

import {
  clearAccessToken,
  decodeTokenClaims,
  getAccessToken,
  hasValidSession,
  storeAccessToken,
} from "./session";
import { SessionExpiryModal } from "@/global_components/SessionExpiryModal/SessionExpiryModal";

interface SessionContextValue {
  user: User | null;
  signIn: (session: Session) => void;
  signOut: () => void;
  restoreFromStoredToken: () => void;
  updateUser: (user: User) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

const IDLE_TIMEOUT_MS = 30 * 1000; // 30s temporal
const IDLE_WARNING_MS = 10 * 1000; // 10s temporal

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
    phone: null,
    avatarUrl: null,
    lastLoginAt: null,
    lastLoginBrowser: null,
    lastLoginOs: null,
    createdAt: "",
    updatedAt: "",
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    hasValidSession() ? userFromClaims() : null,
  );
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.round(IDLE_WARNING_MS / 1000),
  );
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setWarningOpen(false);
    // The cached profile belongs to whoever was signed in; keeping it would
    // leak it to the next user on a shared machine.
    queryClient.removeQueries({ queryKey: queryKeys.me.all });
  }, [queryClient]);

  // Rehydrate profile on mount when only JWT claims are available.
  //
  // `fetchQuery` rather than a bare `api.me()`: it goes through the shared
  // cache, so anything else reading the profile shares this request instead
  // of firing a second one, and the profile lands in the cache where
  // mutations can invalidate it.
  useEffect(() => {
    if (!user) return;
    if (user.firstName && user.email) return;

    let cancelled = false;
    queryClient
      .fetchQuery(meQuery)
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
      })
      .catch(() => {
        // A failed rehydration leaves the claims-derived user in place; the
        // app stays usable and the next mount retries.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle 401 from a session invalidated by another device/browser.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAccessToken();
      setUser(null);
      message.warning(
        "Your session was closed because you signed in on another device or browser.",
      );
      window.location.href = "/";
    });
  }, []);

  // Idle logout (only when a user is signed in).
  useInactivityLogout({
    enabled: user != null,
    idleTimeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onWarning: () => {
      setSecondsLeft(Math.round(IDLE_WARNING_MS / 1000));
      setWarningOpen(true);
    },
    onActivity: () => {
      setWarningOpen(false);
    },
    onExpire: () => {
      signOut();
      message.info("You were signed out due to inactivity.");
      navigate("/", { replace: true });
    },
  });

  // Countdown inside the warning modal.
  useEffect(() => {
    if (!warningOpen) return;

    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [warningOpen]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      signIn: (session: Session) => {
        storeAccessToken(session.accessToken);
        setUser(session.user);
        // Login already returns the full user, so warm the cache instead of
        // letting the first reader refetch what we are holding.
        queryClient.setQueryData(queryKeys.me.all, session.user);
        if (session.previousSessionInvalidated) {
          message.info(
            "You were signed in on another device or browser. That session has been closed.",
          );
        }
      },
      signOut,
      restoreFromStoredToken: () => setUser(userFromClaims()),
      updateUser: (next: User) => setUser(next),
    }),
    [user, signOut, queryClient],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      <SessionExpiryModal
        open={warningOpen}
        secondsLeft={secondsLeft}
        onStay={() => setWarningOpen(false)}
      />
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return context;
}
