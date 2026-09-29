import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * The controls the signed-out pages need, in plain HTML.
 *
 * These exist because antd's vendor chunk is 182 KiB gzipped and the entry
 * imports it unconditionally, so the sign-in page was transferring 182 KiB of UI
 * library to render one form. The `LoginCard`, both `TextField`s, two buttons
 * and a spinner are not worth that.
 *
 * They are not a general-purpose replacement for antd and are not exported
 * outside the public auth pages. Everything authenticated still uses antd; see
 * `AppLayout`, which is where the provider moved to.
 *
 * Styling uses the Tailwind grays from the theme rather than `--ant-color-*`,
 * because those variables are emitted by antd's runtime and will not exist on a
 * page that does not load antd. The greys here match the token values those
 * variables resolved to, so the pages look the same as before.
 */

/**
 * Metrics below are not guesses. They were read off the antd-rendered sign-in
 * page before this file existed, with `getBoundingClientRect` and
 * `getComputedStyle`, and antd's own token file sets `fontSize: 16` and
 * `borderRadius: 8` while leaving `controlHeight` at its 32px default. So:
 * 32px tall, 16px type, 8px radius, and 15px of horizontal padding on buttons,
 * which is antd's `paddingInline` for the default size. A first attempt used
 * 14px type and let the height fall out of the content, which produced 20px
 * buttons against 42px inputs and looked plainly wrong next to the old build.
 */
const FIELD_BASE =
  "h-8 w-full rounded-lg border border-gray-300 bg-white px-[11px] text-base text-gray-900 " +
  "placeholder:text-gray-500 outline-none transition-colors " +
  "focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/25 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  id: string;
  error?: string;
  /** Renders a password field with the same styling. */
  type?: "text" | "email" | "password" | "tel";
  /** Rendered on the label row, e.g. a "Forgot password?" link. */
  labelAccessory?: ReactNode;
}

/**
 * A labelled text input.
 *
 * `type="password"` gets a reveal toggle, because antd's `Input.Password` had
 * one and dropping it silently would be a small regression on a login form where
 * a mistyped character is the most common failure.
 */
export function TextField({
  label,
  id,
  error,
  type = "text",
  labelAccessory,
  ...rest
}: TextFieldProps) {
  const describedBy = error ? `${id}-error` : undefined;
  const [revealed, setRevealed] = useState(false);
  const toggleId = useId();

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-gray-900">
          {label}
        </label>
        {labelAccessory}
      </div>
      <div className="relative">
        <input
          id={id}
          type={revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${FIELD_BASE} ${type === "password" ? "pr-16" : ""}`}
          {...rest}
        />
        {type === "password" ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-controls={toggleId}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      {/*
        `role="alert"` so the message is announced when it appears, which is what
        antd's Alert did for free. The element is always rendered rather than
        conditionally so the field does not jump when the error appears.
      */}
      <p
        id={describedBy}
        role={error ? "alert" : undefined}
        className="mt-1 min-h-4 text-xs text-red-600"
      >
        {error ?? ""}
      </p>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "link";

const BUTTON_BASE =
  "inline-flex h-8 items-center justify-center gap-2 rounded-lg px-[15px] text-base font-medium " +
  "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[#2563EB] text-white hover:bg-[#2C6CEE] active:bg-[#1D4ED8]",
  secondary:
    "border border-gray-300 bg-white text-gray-900 hover:bg-gray-200 active:bg-gray-300",
  // No height here: this variant is used for inline text links, where a 32px
  // box would break the line it sits in.
  link: "h-auto px-0 text-[#1D4ED8] underline-offset-2 hover:underline",
};

function buttonClasses(variant: ButtonVariant, className?: string) {
  return [BUTTON_BASE, BUTTON_VARIANT[variant], className].filter(Boolean).join(" ");
}

interface ActionLinkProps {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  className?: string;
  /** Rendered before the label, e.g. an icon. Decorative by convention. */
  icon?: ReactNode;
  "aria-label"?: string;
}

/**
 * A link that looks like a button.
 *
 * The OAuth providers navigate somewhere, so they are links, and they have to
 * look like the button next to them. The obvious shortcut is an `<a>` wrapped
 * around an `ActionButton`, and that is wrong: it is an interactive control
 * inside an interactive control, and Tab lands on both, so reaching "Continue
 * with Google" from the tab list takes two presses instead of one. Screen
 * readers announce the pair, too. This renders a single anchor with the same
 * classes, so it is one tab stop and one element in the accessibility tree.
 */
export function ActionLink({
  children,
  href,
  variant = "secondary",
  className,
  icon,
  "aria-label": ariaLabel,
}: ActionLinkProps) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      className={buttonClasses(variant, className)}
    >
      {icon}
      {children}
    </a>
  );
}

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
  /** Rendered before the label, e.g. an icon. Decorative by convention. */
  icon?: ReactNode;
  /** Blocks interaction and shows a spinner, for a submit in flight. */
  loading?: boolean;
  "aria-label"?: string;
}

export function ActionButton({
  children,
  onClick,
  type = "button",
  variant = "secondary",
  disabled,
  className,
  icon,
  loading,
  "aria-label": ariaLabel,
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      className={buttonClasses(variant, className)}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/**
 * A spinner without antd's Spin.
 *
 * `role="status"` with visually hidden text, so it announces itself. The border
 * animation is the same shape antd used, so it does not read as a new element.
 */
export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center" role="status">
      <span
        aria-hidden
        className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
