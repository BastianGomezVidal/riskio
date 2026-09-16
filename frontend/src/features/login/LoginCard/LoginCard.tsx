import type { ReactNode } from "react";
import { Card as AntCard } from "antd";
import { semantic } from "../../../design-system/tokens/semantic";

interface CardProps {
  children: ReactNode;
}

export function LoginCard({ children }: CardProps) {
  return (
    <AntCard
      styles={{
        body: {
          padding: semantic.card.padding,
        },
      }}
      style={{
        background: semantic.surface.background,
        borderColor: semantic.surface.border,
        borderRadius: semantic.radius.container,
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.06)",
      }}
    >
      {children}
    </AntCard>
  );
}
