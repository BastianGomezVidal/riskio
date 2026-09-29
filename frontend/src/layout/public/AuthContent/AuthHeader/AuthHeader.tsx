// src/components/AuthHeader/AuthHeader.tsx
import { Link } from "react-router-dom";
import type { AuthMode } from "@/auth/auth-mode";

interface AuthHeaderProps {
  active: AuthMode;
}

const TABS: { mode: AuthMode; to: string; label: string }[] = [
  { mode: "sign-in", to: "/", label: "Sign In" },
  { mode: "sign-up", to: "/signup", label: "Sign Up" },
];

/*
 * The selected tab is a filled blue half on a gray[200] track, and the 4.2:1
 * between them is the whole point.
 *
 * This was grey on grey: #D4D4D4 selected against #F2F2F2 unselected is 1.32:1,
 * and WCAG asks 3:1 to tell two states of a control apart. `shadow-sm` could not
 * rescue it because a shadow needs a luminance step to cast onto, and there was
 * none. Semibold against medium is not a signal either, least of all at 12px.
 *
 * A white pill on a light grey track would have been the other obvious answer
 * and it is worse: white on gray[200] is 1.26:1, so it leans entirely on the
 * shadow, which is the exact mechanism that already failed here. Only a filled
 * colour clears 3:1 without depending on how bright the room is.
 *
 * The segments meet with no gap and no inset padding, and the track clips them,
 * so the two halves add up to the full width of the parent. With `gap-1 p-1` they
 * came to 322px inside a 334px track and the leftover 12px read as accidental
 * slivers of grey behind the buttons rather than as design.
 *
 * The blue is `bg-[#2563EB]` and not the `blue-600` class on purpose. Tailwind v4
 * ships `blue-600` as oklch(54.6% 0.245 262.881), which renders #155DFC, while
 * this repo's tokens say blue[600] is #2563EB. The submit button below is an antd
 * `type="primary"` fed from those tokens, so the class would have put a #155DFC
 * half directly above a #2563EB button. Greys agree between the two systems, so
 * `gray-200` is safe as a class and the blue is not.
 *
 * Hover is `transition-colors` on background only, and it lightens on both
 * segments: the selected half goes to blue[550] and the unselected half washes
 * towards white. It used to darken the selected half while the unselected one
 * lightened, which read as two different controls sharing one track.
 *
 * blue[550] rather than blue[500], which is the obvious "lighter blue": white on
 * blue[500] is 3.68:1, so the label would drop under AA exactly while the pointer
 * is on it. See the note on blue[550] in primitives.ts.
 *
 * Text stays grey[600] on the track (6.1:1) and white on the fill (5.2:1).
 *
 * The `!` suffix on the colour utilities is not optional. antd injects
 * `:where(.css-hash) a { background: transparent; color: var(--ant-color-link) }
 * as an unlayered stylesheet, and unlayered normal declarations outrank every
 * layer, so `bg-[#2563EB]` and `text-white` are silently dropped and the segment
 * renders in the antd link blue on a transparent ground. Measured, not assumed:
 * without the `!` the selected half computed to `rgba(0,0,0,0)`. It applies to
 * the `hover:` variants too, for the same reason.
 */
export function AuthHeader({ active }: AuthHeaderProps) {
  return (
    <nav
      role="tablist"
      className="flex overflow-hidden rounded-lg bg-gray-200"
      aria-label="Authentication mode"
    >
      {TABS.map((tab) => {
        const selected = active === tab.mode;
        return (
          <Link
            key={tab.mode}
            to={tab.to}
            role="tab"
            aria-selected={selected}
            aria-current={selected ? "page" : undefined}
            className={`flex-1 py-2 text-center text-sm outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1D4ED8] ${
              selected
                ? "bg-[#2563EB]! font-semibold text-white! hover:bg-[#2C6CEE]!"
                : "font-medium text-gray-600! hover:bg-white/70! hover:text-gray-900!"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
