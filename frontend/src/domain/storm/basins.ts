/**
 * Display metadata for NHC basin codes.
 *
 * Colors are antd's semantic Tag colors (`blue`, `green`, `purple`), which
 * the app's theme resolves against the configured palette.
 */
export const BASIN: Record<string, { label: string; color: string }> = {
  AL: { label: "Atlantic", color: "blue" },
  EP: { label: "East Pacific", color: "green" },
  CP: { label: "Central Pacific", color: "purple" },
};

/** Label for a basin code, falling back to the code itself. */
export function basinLabel(code: string): string {
  return BASIN[code]?.label ?? code;
}
