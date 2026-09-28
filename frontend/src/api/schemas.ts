import { z } from "zod";
import type {
  ForgotPasswordResult,
  ResetPasswordResult,
  Session,
} from "@/domain/auth";
import type { DashboardSummary } from "@/domain/dashboard";
import type {
  AdvisoryDetail,
  ForecastPoint,
  StormAggregate,
  StormAdvisoryDetail,
  StormDetail,
  StormListItem,
} from "@/domain/storm";
import type { User } from "@/domain/users";

/**
 * Runtime contracts for every API response.
 *
 * TypeScript only checks these shapes at build time, against the code that
 * happens to be deployed. If the backend ships a different payload — a
 * renamed field, a nullable that became required — the old `as T` cast in
 * the client turned the mismatch into `undefined` values that surfaced
 * somewhere else entirely, minutes later, as a broken render. Parsing at the
 * boundary converts that into a loud, attributable error.
 *
 * The exported `Assert` types at the bottom pin each schema to the
 * hand-written interface it mirrors, so a field added to one side and not the
 * other stops compiling instead of drifting silently.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

const isoDate = z.string().min(1);
const nullableIsoDate = z.string().min(1).nullable();

/** GeoJSON geometry, kept loose on purpose: only the fields the map reads. */
const lineString = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});

const polygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

/* ------------------------------------------------------------------ */
/* Users & auth                                                        */
/* ------------------------------------------------------------------ */

export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: z.enum(["admin", "client"]),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  lastLoginAt: nullableIsoDate,
  lastLoginBrowser: z.string().nullable(),
  lastLoginOs: z.string().nullable(),
});

export const sessionSchema = z.object({
  accessToken: z.string().min(1),
  user: userSchema,
  previousSessionInvalidated: z.boolean(),
});

/**
 * Only the neutral message. The API deliberately does not echo the address or
 * hand back the temporary password, so that the response cannot be used to
 * enumerate which emails have an account.
 */
export const forgotPasswordResultSchema = z.object({
  message: z.string(),
});

/** Answer to redeeming a reset link. */
export const resetPasswordResultSchema = z.object({
  message: z.string(),
});


/* ------------------------------------------------------------------ */
/* Storms                                                              */
/* ------------------------------------------------------------------ */

export const forecastPointSchema = z.object({
  id: z.string(),
  validAt: isoDate,
  latitude: z.number(),
  longitude: z.number(),
  windSpeedKt: z.number().nullable(),
  pressureMb: z.number().nullable(),
  category: z.number().nullable(),
});

export const stormSchema = z.object({
  atcfId: z.string(),
  name: z.string().nullable(),
  basin: z.string(),
  firstSeenAt: isoDate,
  lastSeenAt: isoDate,
  isActive: z.boolean(),
  lastSeenInFeedAt: nullableIsoDate,
});

export const stormAggregateSchema = stormSchema.extend({
  advisoryCount: z.number(),
  latestAdvisoryNumber: z.number().nullable(),
  latestAdvisoryIssuedAt: nullableIsoDate,
});

export const advisoryRefSchema = z.object({
  id: z.string(),
  advisoryNumber: z.number(),
  issuedAt: isoDate,
});

export const advisoryDetailSchema = z.object({
  id: z.string(),
  advisoryNumber: z.number(),
  issuedAt: isoDate,
  rawText: z.string().nullable(),
  ingestedAt: isoDate,
  track: lineString.nullable(),
  cone: polygon.nullable(),
  storm: stormSchema.optional(),
  forecastPoints: z.array(forecastPointSchema),
  // geometry is included on purpose. z.object() strips undeclared keys, so
  // leaving it out here would delete the warning segments on the way in and
  // the map would quietly draw nothing.
  warnings: z.array(
    z.object({
      id: z.string(),
      warningType: z.string(),
      geometry: lineString.nullable(),
    }),
  ),
});

/** Response of GET /storms. */
export const stormsListSchema = z.array(stormAggregateSchema);

export const stormDetailSchema = stormAggregateSchema.extend({
  advisories: z.array(advisoryRefSchema),
});

export const stormAdvisoryDetailSchema = z.object({
  storm: stormAggregateSchema,
  advisory: advisoryDetailSchema,
});

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

const stormRiskLevelSchema = z.enum(["low", "moderate", "high"]);

export const dashboardSummarySchema = z.object({
  generatedAt: isoDate,
  totals: z.object({
    events: z.number(),
    named: z.number(),
    hurricanes: z.number(),
    ace: z.number(),
    pacific: z.number(),
    atlantic: z.number(),
  }),
  storms: z.array(
    z.object({
      storm: stormAggregateSchema,
      riskLevel: stormRiskLevelSchema,
      latestAdvisory: z
        .object({
          id: z.string(),
          advisoryNumber: z.number(),
          issuedAt: isoDate,
          forecastPoints: z.array(forecastPointSchema),
        })
        .nullable(),
    }),
  ),
});

/* ------------------------------------------------------------------ */
/* Drift guards                                                        */
/* ------------------------------------------------------------------ */

type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type Assert<T extends true> = T;

export type SchemaMatchesDomain = [
  Assert<Exact<z.infer<typeof userSchema>, User>>,
  Assert<Exact<z.infer<typeof sessionSchema>, Session>>,
  Assert<
    Exact<z.infer<typeof forgotPasswordResultSchema>, ForgotPasswordResult>
  >,
  Assert<
    Exact<z.infer<typeof resetPasswordResultSchema>, ResetPasswordResult>
  >,
  Assert<Exact<z.infer<typeof stormAggregateSchema>, StormAggregate>>,
  Assert<Exact<z.infer<typeof stormsListSchema>, StormListItem[]>>,
  Assert<Exact<z.infer<typeof stormDetailSchema>, StormDetail>>,
  Assert<Exact<z.infer<typeof stormAdvisoryDetailSchema>, StormAdvisoryDetail>>,
  Assert<Exact<z.infer<typeof advisoryDetailSchema>, AdvisoryDetail>>,
  Assert<Exact<z.infer<typeof forecastPointSchema>, ForecastPoint>>,
  Assert<Exact<z.infer<typeof dashboardSummarySchema>, DashboardSummary>>,
];
