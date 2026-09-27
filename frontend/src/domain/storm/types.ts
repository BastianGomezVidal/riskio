/** Risk level as computed server-side for a storm aggregate. */
export type StormRiskLevel = "low" | "moderate" | "high";

/** Directory tabs supported by GET /storms. */
export type StormsTab = "active" | "past";

/** Sort orders supported by GET /storms. */
export type StormsSort = "newest" | "oldest" | "name_asc" | "name_desc";
