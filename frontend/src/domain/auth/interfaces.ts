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
