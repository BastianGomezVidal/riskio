import type { ReactNode } from "react";
import { semantic } from "@/design-system/tokens/semantic";

interface CardProps {
  children: ReactNode;
}

/**
 * The sign-in card.
 *
 * Was an antd `Card` whose only configuration was the body padding, a
 * background, a border colour, a radius and a box shadow — all of which this
 * already had as design tokens. antd contributed a wrapper element and a 182 KiB
 * dependency on the page whose whole job is to be the first thing anyone loads.
 *
 * The token values are kept in the inline style rather than converted to
 * Tailwind classes so the card keeps reading from the same source of truth the
 * old `style` prop used.
 */
export function LoginCard({ children }: CardProps) {
  return (
    <div
      style={{
        background: semantic.surface.background,
        borderColor: semantic.surface.border,
        borderRadius: semantic.radius.container,
        borderWidth: 1,
        borderStyle: "solid",
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.06)",
        padding: semantic.card.padding,
      }}
    >
      {children}
    </div>
  );
}
