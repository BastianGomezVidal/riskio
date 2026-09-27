import { User } from "../users";

export interface Session {
  accessToken: string;
  user: User;
  previousSessionInvalidated: boolean;
}

/**
 * The API answers with a neutral message and nothing else — no address, no
 * temporary password — so the response cannot be used to discover which emails
 * have an account.
 */
export interface ForgotPasswordResult {
  message: string;
}

/**
 * What the user chose as their new password, plus the token from the emailed
 * link. The API answers with the same neutral shape as a forgot-password
 * request; only the token distinguishes success from failure.
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResult {
  message: string;
}
