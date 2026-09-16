export const primitives = {
  colors: {
    white: "#FFFFFF",
    black: "#000000",

    gray: {
      50: "#F9FAFB",
      100: "#F3F4F6",
      200: "#E5E7EB",
      300: "#D1D5DB",
      400: "#9CA3AF",
      500: "#6B7280",
      600: "#4B5563",
      700: "#374151",
      800: "#1F2937",
      900: "#111827",
    },

    red: {
      500: "#EF4444",
      600: "#DC2626",
    },

    green: {
      500: "#22C55E",
      600: "#16A34A",
    },

    blue: {
      500: "#3B82F6",
      600: "#2563EB",
    },
  },

  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
  },

  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
} as const;
