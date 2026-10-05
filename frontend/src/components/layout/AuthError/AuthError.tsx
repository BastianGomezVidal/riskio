import type { ReactNode } from "react";

/**
 * Compact red form-level error that leaves room for the next element.
 *
 * Was an antd `Alert`, which is the only thing here that needed antd. The
 * markup below is what `Alert type="error"` rendered anyway: a bordered, tinted
 * box with the message in it. `role="alert"` is antd's own live-region
 * behaviour, kept deliberately — an error that appears without being announced
 * is an error a screen reader user never learns about.
 */
export function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-3 rounded-md border border-red-200 bg-red-200/25 px-3 py-2 text-xs text-red-600"
    >
      {message}
    </div>
  );
}

/** Small red helper under a field; cleared as soon as the field changes. */
export function FieldError({ children }: { children: ReactNode }) {
  if (!children) {
    return null;
  }
  return (
    <p className="mt-1 text-xs leading-5 text-red-600" role="alert">
      {children}
    </p>
  );
}
