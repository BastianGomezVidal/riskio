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
      // The hover step for a solid blue fill. It is not 500: white on #3B82F6 is
      // 3.68:1 and on #2C6CEE it is 4.67:1, so lightening the fill all the way to
      // 500 puts the label under AA while the pointer is on it. 550 is the
      // lightest blue that still clears 4.5:1 against white text and 3:1 against
      // the gray[200] track the auth tabs sit on.
      550: "#2C6CEE",
      // The only blue dark enough to carry text on a coloured ground. 600 is
      // 4.8:1 on white; 700 is 6.7:1 on white and still legible on the
      // gray[200] track, so links can use it without anyone having to remember
      // which grey is behind which one.
      700: "#1D4ED8",
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
