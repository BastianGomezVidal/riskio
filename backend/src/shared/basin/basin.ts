export const BASIN_NAMES = ['at', 'ep', 'cp'] as const;
export type BasinName = (typeof BASIN_NAMES)[number];
