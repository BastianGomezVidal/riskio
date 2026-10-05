import { useEffect, useRef } from "react";

interface Options {
  /** Total idle time before sign out, in ms. Default: 10 min. */
  idleTimeoutMs?: number;
  /** Time before timeout to trigger the warning callback, in ms. Default: 30s. */
  warningMs?: number;
  /** Called when the idle timeout is reached. Usually signOut + redirect. */
  onExpire: () => void;
  /**
   * Called when the warning threshold is reached, with the absolute
   * timestamp at which the session will actually end.
   *
   * The deadline is passed rather than a duration because a modal counting
   * down with its own interval and a logout fired by a separate timeout are
   * two clocks, and they disagree. Browsers throttle timers in hidden tabs to
   * roughly once a minute, so the countdown froze at "10 seconds" while the
   * expiry fired on time and signed the user out mid-count. Deriving both from
   * one deadline makes that impossible.
   */
  onWarning?: (expiresAt: number) => void;
  /** Called whenever activity is detected (useful to dismiss the warning). */
  onActivity?: () => void;
  /** When false, the hook does nothing. Default: true. */
  enabled?: boolean;
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

const THROTTLE_MS = 1_000;

/**
 * Signs the user out after a period of inactivity.
 *
 * Fires `onWarning` before the timeout, and `onExpire` at the timeout.
 * Any activity resets the timers and calls `onActivity`.
 */
export function useInactivityLogout({
  idleTimeoutMs = 10 * 60 * 1000,
  warningMs = 30 * 1000,
  onExpire,
  onWarning,
  onActivity,
  enabled = true,
}: Options): void {
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Keep the callbacks in refs so the effect below never needs to re-run.
  const expireRef = useRef(onExpire);
  const warningRef = useRef(onWarning);
  const activityRef = useRef(onActivity);

  useEffect(() => {
    expireRef.current = onExpire;
    warningRef.current = onWarning;
    activityRef.current = onActivity;
  }, [onExpire, onWarning, onActivity]);

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };

    const scheduleTimers = () => {
      clearTimers();

      const warningDelay = Math.max(0, idleTimeoutMs - warningMs);
      const expiresAt = Date.now() + idleTimeoutMs;

      warningTimerRef.current = setTimeout(() => {
        warningRef.current?.(expiresAt);
      }, warningDelay);

      expireTimerRef.current = setTimeout(() => {
        expireRef.current();
      }, idleTimeoutMs);
    };

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < THROTTLE_MS) return;

      lastActivityRef.current = now;
      activityRef.current?.();
      scheduleTimers();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
      }
    };

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", handleVisibility);

    scheduleTimers();

    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handleActivity),
      );
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimers();
    };
  }, [enabled, idleTimeoutMs, warningMs]);
}
