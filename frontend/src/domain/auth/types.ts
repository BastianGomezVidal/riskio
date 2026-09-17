export type Role = "admin" | "client";

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export interface Session {
  accessToken: string;
  user: User;
}

export interface ForgotPasswordResult {
  email: string;
  temporaryPassword: string;
  message: string;
}