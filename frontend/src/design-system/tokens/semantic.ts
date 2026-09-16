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

    error: primitives.colors.red[600],
    success: primitives.colors.green[600],
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
  },

  card: {
    padding: primitives.spacing[6],
  },
} as const;
