import { z } from "zod";
import type { StormsQuery } from "@/domain/storm";
import type { ResetPasswordRequest } from "@/domain/auth";
import { tracer, telemetryReady, NOOP_SPAN } from "@/observability/telemetry";
import { context, trace } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";

const tracePropagator = new W3CTraceContextPropagator();
import type { Span } from "@opentelemetry/api";
import { getAccessToken } from "@/auth/session";
import {
  dashboardSummarySchema,
  forgotPasswordResultSchema,
  resetPasswordResultSchema,
  sessionSchema,
  stormAdvisoryDetailSchema,
  stormDetailSchema,
  stormsListSchema,
  userSchema,
} from "./schemas";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Raised when a response parses as JSON but does not match the contract.
 * Kept distinct from ApiError so the UI can tell "the server said no" from
 * "the server said something we do not understand".
 */
export class ApiContractError extends Error {
  constructor(
    message: string,
    readonly issues: string,
  ) {
    super(message);
    this.name = "ApiContractError";
  }
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  // This is the single point where the app talks to the API, so a span here
  // covers all twenty api methods. The exporter injects traceparent into the
  // headers, which is what makes the browser span and the server span one
  // trace rather than two.
  return withSpan(`HTTP ${methodOf(init)} ${path}`, async (span) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: buildHeaders(init),
    });

    span.setAttribute('http.status_code', response.status);
    span.setAttribute('http.route', path);

    if (!response.ok) {
      throw await toApiError(response);
    }

    if (response.status === 204) {
      return undefined as z.infer<S>;
    }

    const payload: unknown = await response.json().catch(() => {
      throw new ApiContractError(
        `Malformed response from ${path}: body was not JSON.`,
        "",
      );
    });

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ");
      throw new ApiContractError(
        `Response from ${path} did not match the expected shape: ${issues}`,
        path,
      );
    }

    return parsed.data;
  });
}

function methodOf(init?: RequestInit): string {
  return (init?.method ?? 'GET').toUpperCase();
}

async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  if (!telemetryReady) {
    return fn(NOOP_SPAN);
  }
  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}


function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);

  // Only default to JSON when the caller has not set a Content-Type.
  // FormData sets it automatically with the multipart boundary.
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach the JWT when present. Auth endpoints ignore it.
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Carry the W3C trace context to the API. This is the line that makes a
  // browser trace and a server trace one trace instead of two: the server
  // reads traceparent and continues the same id. Injected here rather than by
  // the fetch instrumentation, which stays disabled so the call is not
  // counted twice.
  const activeSpan = trace.getActiveSpan();
  if (telemetryReady && activeSpan) {
    tracePropagator.inject(context.active(), headers, {
      set: (_carrier, key, value) => headers.set(key, value),
    });
  }

  return headers;
}

async function toApiError(response: Response): Promise<ApiError> {
  if (response.status === 401 && getAccessToken()) {
    onUnauthorized?.();
  }

  const body = await response.text().catch(() => "");
  const message = extractError(body) ?? `API returned ${response.status}`;
  return new ApiError(message, response.status);
}

/** Endpoints that answer 204 with no body. */
async function requestEmpty(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: buildHeaders(init),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Incorrect email or password. Double-check your credentials and try again.";
    }
    if (error.status === 409) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (error.status === 404) {
      return "We couldn't find an account for that email.";
    }
    return error.message || "Something went wrong. Please try again.";
  }
  return "We couldn't reach the service. Please check your connection and try again.";
}

function extractError(body: string): string | null {
  try {
    const json = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(json.message)) return json.message.join("; ");
    if (typeof json.message === "string") return json.message;
  } catch {
    /* not JSON */
  }
  return null;
}

export function oauthAuthorizeUrl(provider: "google" | "outlook"): string {
  return `${API_URL}/auth/oauth/${provider}`;
}

export const api = {
  // ── Storms ────────────────────────────────────────────────────────

  storms: (query: StormsQuery) => {
    const params = new URLSearchParams();
    params.set("tab", query.tab);
    if (query.q) params.set("q", query.q);
    if (query.sort) params.set("sort", query.sort);
    if (query.basin) params.set("basin", query.basin);
    if (query.cat) params.set("cat", query.cat);
    if (query.yearFrom != null) params.set("yearFrom", String(query.yearFrom));
    if (query.yearTo != null) params.set("yearTo", String(query.yearTo));
    return request(`/storms?${params.toString()}`, stormsListSchema);
  },

  storm: (atcfId: string) =>
    request(`/storms/${encodeURIComponent(atcfId)}`, stormDetailSchema),

  stormAdvisory: (atcfId: string, n: string) =>
    request(
      `/storms/${encodeURIComponent(atcfId)}/advisories/${encodeURIComponent(n)}`,
      stormAdvisoryDetailSchema,
    ),

  // ── Auth ──────────────────────────────────────────────────────────

  register: (input: {
    firstName: string;
    lastName: string;
    phone?: string;
    email: string;
    password: string;
  }) =>
    request("/auth/register", sessionSchema, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (email: string, password: string) =>
    request("/auth/login", sessionSchema, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email: string) =>
    request("/auth/forgot-password", forgotPasswordResultSchema, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (body: ResetPasswordRequest) =>
    request("/auth/reset-password", resetPasswordResultSchema, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ── Dashboard ─────────────────────────────────────────────────────

  dashboardSummary: () => request("/dashboard/summary", dashboardSummarySchema),

  // ── Users ─────────────────────────────────────────────────────────

  me: () => request("/users/me", userSchema),

  updateMe: (patch: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) =>
    request("/users/me", userSchema, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request("/users/me/avatar", userSchema, {
      method: "POST",
      body: form,
    });
  },

  deleteMe: () => requestEmpty("/users/me", { method: "DELETE" }),

};

