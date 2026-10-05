import type { StormAggregate, StormsTab } from "@/domain/storm";
import { formatUTC } from "@/helpers/datetime";

/**
 * Display name for a storm: the given name, or `Invest <ATCF id>` when
 * the storm has no name yet.
 */
export function stormDisplayName(storm: {
  name: string | null;
  atcfId: string;
}): string {
  return storm.name ?? `Invest ${storm.atcfId}`;
}

/**
 * Directory tab a storm belongs to (drives `/storms?tab=...` links).
 */
export function stormTab(storm: { isActive: boolean }): StormsTab {
  return storm.isActive ? "active" : "past";
}

/**
 * Status label shown in the storm header chip.
 */
export function stormStatusLabel(isActive: boolean): "Active" | "Past" {
  return isActive ? "Active" : "Past";
}

export function toWhen(isActive: boolean, storm: StormAggregate): string {
  return isActive ? "now" : formatUTC(storm.lastSeenAt);
}
