import { BASIN } from "@/domain/storm";

export function basinLabel(code: string): string {
  return BASIN[code]?.label ?? code;
}
