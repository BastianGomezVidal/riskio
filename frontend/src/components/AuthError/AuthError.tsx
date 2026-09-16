import type { CSSProperties, ReactNode } from "react";
import { Alert } from "antd";

const COMPACT_ERROR_STYLE: CSSProperties = { fontSize: 12 };

/** Compact red form-level error that leaves room for the next element. */
export function FormError({ message }: { message: string }) {
  return (
    <Alert type="error" showIcon className="mb-3" style={COMPACT_ERROR_STYLE} message={message} />
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