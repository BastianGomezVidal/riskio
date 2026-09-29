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
import { api, setUnauthorizedHandler } from "@/api/client";
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

/**
 * Idle sign-out, in milliseconds.
 *
 * These were 30s and 10s, marked "temporal" and never revisited. Thirty
 * seconds is not a session: anyone reading a page, or watching a storm map
 * without touching the mouse, was signed out. It is 15 minutes now, which is
 * long enough to walk away from a desk and short enough that an unattended
 * machine does not keep a token alive all afternoon.
 *
 * Overridable per environment through the Vite env, because a value that is
 * wrong for one deployment is usually right for another and a rebuild should
 * not be the way to find out.
 */
const IDLE_TIMEOUT_MS = readDuration(
  import.meta.env.VITE_IDLE_TIMEOUT_MS,
  15 * 60 * 1000,
);
const IDLE_WARNING_MS = readDuration(
  import.meta.env.VITE_IDLE_WARNING_MS,
  60 * 1000,
);

/**
 * Reads a millisecond duration from the environment.
 *
 * Two traps, both of which produce the same symptom this change is fixing.
 * Vite only substitutes `import.meta.env.NAME` statically, so a computed key
 * like `import.meta.env[name]` compiles to undefined in a production build and
 * silently falls back — hence the call sites pass the value, not the name.
 * And these arrive as strings, where `Number("")` is 0, so a variable declared
 * but left empty would mean "sign out immediately".
 */
function readDuration(raw: string | undefined, fallbackMs: number): number {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallbackMs;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;

  return parsed;
}

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
  /**
   * Absolute moment the session ends, not a number of seconds remaining.
   * A countdown that decrements its own state cannot notice that its timers
   * were throttled while the tab was hidden, so it would happily display ten
   * seconds while the session was already gone.
   */
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = useCallback(() => {
    /**
     * Tell the server before dropping the token, because the token is the only
     * credential the call can carry.
     *
     * Fire and forget, and never awaited by the caller: the local clear below
     * has to happen either way. Someone on a train who signs out must end up
     * signed out, not stuck because the request could not land. The rejection
     * is swallowed for the same reason — an unhandled one would surface as an
     * error in the console and imply the sign-out failed when it did not.
     *
     * This is what makes signing in again not report displacing another
     * session. The server reads a non-null `currentSessionId` as "there was a
     * live session here", so without this call a sign-out followed by a sign-in
     * told the user their own session had been closed on another device.
     */
    void api.logout().catch(() => {});

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
    onWarning: (deadline) => {
      setExpiresAt(deadline);
      setNow(Date.now());
      setWarningOpen(true);
    },
    onActivity: () => {
      setWarningOpen(false);
      setExpiresAt(null);
    },
    onExpire: () => {
      signOut();
      message.info("You were signed out due to inactivity.");
      navigate("/", { replace: true });
    },
  });

  /**
   * Countdown inside the warning modal, derived from the deadline.
   *
   * The interval only re-reads the clock; it does not count. So a throttled
   * background tab resumes showing the real remaining time instead of a stale
   * one, and the number on screen and the moment of sign-out cannot disagree.
   */
  useEffect(() => {
    if (!warningOpen || expiresAt === null) return;

    setNow(Date.now());
    // 250ms rather than 1000: the displayed value is whole seconds, and a
    // once-a-second tick would keep showing "10" for a full extra second after
    // the real remaining time had already dropped to 9. Cheap here — the
    // countdown state lives above the modal, and `children` is a prop whose
    // identity does not change, so the page below does not re-render.
    const interval = setInterval(() => setNow(Date.now()), 250);

    return () => clearInterval(interval);
  }, [warningOpen, expiresAt]);

  const secondsLeft =
    expiresAt === null
      ? 0
      : Math.max(0, Math.ceil((expiresAt - now) / 1000));

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
