import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/**
 * A toast queue, replacing antd's static `message` helper.
 *
 * The static API is the reason this could not just be dropped: `message.info()`
 * works from anywhere with no provider, which is convenient right up until the
 * module holding it is the reason the sign-in page downloads 182 KiB. A context
 * plus a hook keeps the ergonomics for the three call sites and costs a provider
 * that `AppLayout` already has to provide for antd.
 *
 * Rendered through a portal to `document.body` so it is not clipped by the
 * card it is announced over, and marked `role="status"` with
 * `aria-live="polite"` so a message that appears is read without interrupting
 * whatever the user was doing.
 */

export type ToastTone = "info" | "warning";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// Only the greys this theme actually defines: 200, 300, 500, 600, 700, 900.
// There is no 50, no 100, no 400, and no amber, so a class naming one would
// compile to nothing and the toast would render unstyled.
const TONE_CLASS: Record<ToastTone, string> = {
  info: "border-gray-300 bg-white text-gray-600",
  warning: "border-gray-500 bg-white font-medium text-gray-900",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-4 z-100 flex flex-col items-center gap-2 px-4"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`pointer-events-auto max-w-sm rounded-md border px-4 py-2 text-sm shadow-lg ${TONE_CLASS[toast.tone]}`}
              >
                {toast.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  // A no-op outside the provider, so a component rendered in isolation (a test,
  // a storybook) does not have to be wrapped just to be quiet.
  return ctx ?? { notify: () => {} };
}
