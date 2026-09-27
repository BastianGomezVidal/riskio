import type {
  StormAdvisoryDetail,
  StormDetail,
  StormListItem,
  StormsQuery,
} from "@/domain/storm";
import type { ForgotPasswordResult, Session } from "@/domain/auth";
import type { DashboardSummary } from "@/domain/dashboard";
import type { User } from "@/domain/users";
import { getAccessToken } from "@/auth/session";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && getAccessToken()) {
      onUnauthorized?.();
    }

    const body = await response.text().catch(() => "");
    const message = extractError(body) ?? `API returned ${response.status}`;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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
  health: () => request<{ status: string }>("/health"),

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
    return request<StormListItem[]>(`/storms?${params.toString()}`);
  },

  storm: (atcfId: string) =>
    request<StormDetail>(`/storms/${encodeURIComponent(atcfId)}`),

  stormAdvisory: (atcfId: string, n: string) =>
    request<StormAdvisoryDetail>(
      `/storms/${encodeURIComponent(atcfId)}/advisories/${encodeURIComponent(n)}`,
    ),

  // ── Auth ──────────────────────────────────────────────────────────

  register: (input: {
    firstName: string;
    lastName: string;
    phone?: string;
    email: string;
    password: string;
  }) =>
    request<Session>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (email: string, password: string) =>
    request<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email: string) =>
    request<ForgotPasswordResult>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  tokens: () =>
    request<{ id: string; name: string; prefix: string }[]>("/auth/tokens"),

  // ── Dashboard ─────────────────────────────────────────────────────

  dashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),

  // ── Users ─────────────────────────────────────────────────────────

  me: () => request<User>("/users/me"),

  updateMe: (patch: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) =>
    request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<User>("/users/me/avatar", {
      method: "POST",
      body: form,
    });
  },

  deleteMe: () =>
    request<void>("/users/me", {
      method: "DELETE",
    }),
};
