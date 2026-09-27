import { User } from "../users";

export interface Session {
  accessToken: string;
  user: User;
  previousSessionInvalidated: boolean;
}

export interface ForgotPasswordResult {
  email: string;
  temporaryPassword: string;
  message: string;
}
