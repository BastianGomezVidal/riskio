import { primitives } from "./primitives";
import { typography } from "./typography";

export const semantic = {
  colors: {
    background: primitives.colors.white,
    textPrimary: primitives.colors.gray[900],
    textSecondary: primitives.colors.gray[600],
    textPlaceholder: primitives.colors.gray[500],
    borderDefault: primitives.colors.gray[300],
    primary: primitives.colors.blue[600],
    secondary: primitives.colors.gray[100],
    error: primitives.colors.red[600],
    success: primitives.colors.green[600],
    headerBackground: primitives.colors.blue[600],
    headerText: primitives.colors.white,
    headerTextMuted: "rgba(255, 255, 255, 0.75)",
    headerHover: "rgba(255, 255, 255, 0.12)",
    headerActive: "rgba(255, 255, 255, 0.18)",
  },

  typography: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: typography.lineHeight,
  },

  radius: {
    control: primitives.radius.md,
    container: primitives.radius.lg,
  },

  spacing: primitives.spacing,

  surface: {
    background: primitives.colors.white,
    border: primitives.colors.gray[200],
    raised: primitives.colors.gray[50],
    raisedHover: primitives.colors.gray[100],
  },

  card: {
    padding: primitives.spacing[6],
  },

  accents: {
    primary: primitives.colors.blue[600],
    primaryLight: primitives.colors.blue[500],
    warm: primitives.colors.red[600],
    cool: primitives.colors.gray[50],
  },

  gradient: {
    header: `linear-gradient(135deg, ${primitives.colors.blue[500]} 0%, ${primitives.colors.blue[600]} 100%)`,
    footer: `linear-gradient(180deg, ${primitives.colors.white} 0%, ${primitives.colors.gray[50]} 100%)`,
  },

  elevation: {
    modal: "0 24px 48px -12px rgba(15, 23, 42, 0.35)",
  },

  motion: {
    fast: "150ms",
    ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;
