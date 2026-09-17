import type {
  AdvisoryDetail,
  StormDetail,
} from "@/domain/storm";
import type {
  ForgotPasswordResult,
  Session,
} from "@/domain/auth";
import type { DashboardSummary } from "@/domain/dashboard";

/** Base URL of the Riskio backend API. */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** Tiny typed fetch wrapper; the web app never shares code with the backend. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const message = extractError(body) ?? `API returned ${response.status}`;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Maps API/network errors to a friendly, short message for non-technical users. */
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

/** OAuth provider consent URL that starts a Google/Outlook sign-in. */
export function oauthAuthorizeUrl(provider: "google" | "outlook"): string {
  return `${API_URL}/auth/oauth/${provider}`;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  storm: (atcfId: string) =>
    request<StormDetail>(`/storms/${encodeURIComponent(atcfId)}`),

  advisory: (id: string) =>
    request<AdvisoryDetail>(`/advisories/${encodeURIComponent(id)}`),

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

  dashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
};