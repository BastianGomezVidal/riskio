// src/components/AuthContent/InternalAuth.tsx
import { useActionState, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "antd";
import { api, authErrorMessage } from "@/api/client";
import type { AuthMode } from "@/auth/auth-mode";
import { useSession } from "@/auth/session-context";
import { EMAIL_PATTERN } from "@/auth/validation";
import { FieldError, FormError } from "../AuthError/AuthError";

interface InternalAuthProps {
  mode: AuthMode;
}

interface AuthErrors {
  form: string | null;
  fields: Record<string, string>;
}

const EMPTY_ERRORS: AuthErrors = { form: null, fields: {} };

/*
 * No link in this file sets a `text-*` colour, on purpose.
 *
 * The links take `semantic.colors.link` (#1D4ED8) through antd's `colorLink`.
 * They used to carry `text-gray-600` / `text-gray-900`, which never applied:
 * antd injects `:where(.css-hash) a { background: transparent; color: ... }`
 * unlayered, and unlayered normal declarations outrank every layer, so Tailwind
 * lost regardless of specificity. The className was describing a grey link while
 * the browser painted a blue one, which is worse than having no colour at all:
 * the next person to read it believes the design is grey.
 *
 * Hover is underline rather than a darker grey, because there is no darker
 * version of this blue to reach for and underline is the honest affordance.
 */

export function InternalAuth({ mode }: InternalAuthProps) {
  const { signIn } = useSession();
  const isSignIn = mode === "sign-in";
  const [errors, setErrors] = useState<AuthErrors>(EMPTY_ERRORS);

  const [, formAction, pending] = useActionState(
    async (_previous: AuthErrors | null, formData: FormData) => {
      const firstName = String(formData.get("firstName") ?? "").trim();
      const lastName = String(formData.get("lastName") ?? "").trim();
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");

      const fields: Record<string, string> = {};
      if (!isSignIn && !firstName) {
        fields.firstName = "Enter your first name";
      }
      if (!isSignIn && !lastName) {
        fields.lastName = "Enter your last name";
      }
      if (!email) {
        fields.email = "Enter your email address";
      } else if (!EMAIL_PATTERN.test(email)) {
        fields.email = "Enter a valid email address";
      }
      if (!password) {
        fields.password = "Enter your password";
      } else if (!isSignIn && password.length < 8) {
        fields.password = "Use at least 8 characters";
      }

      if (Object.keys(fields).length > 0) {
        setErrors({ form: null, fields });
        return null;
      }

      try {
        const session = isSignIn
          ? await api.login(email, password)
          : await api.register({
              firstName,
              lastName,
              phone: String(formData.get("phone") ?? "").trim() || undefined,
              email,
              password,
            });
        setErrors(EMPTY_ERRORS);
        signIn(session);
      } catch (err) {
        setErrors({ form: authErrorMessage(err), fields: {} });
      }
      return null;
    },
    null,
  );

  function clearError(field: string) {
    setErrors((prev) => {
      if (prev.form === null && prev.fields[field] === undefined) {
        return prev;
      }
      const fields = { ...prev.fields };
      delete fields[field];
      return { form: null, fields };
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-300" />
        <h3 className="text-xs font-medium text-gray-500">
          {isSignIn ? "Sign in with email" : "Create your account"}
        </h3>
        <div className="h-px flex-1 bg-gray-300" />
      </div>

      <form action={formAction} noValidate className="mt-6 space-y-4">
        {!isSignIn && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="firstName"
                className="mb-1 block text-sm font-medium text-gray-900"
              >
                First name
              </label>
              <Input
                id="firstName"
                name="firstName"
                placeholder="Ada"
                maxLength={80}
                autoComplete="given-name"
                onChange={() => clearError("firstName")}
              />
              <FieldError>{errors.fields.firstName}</FieldError>
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-1 block text-sm font-medium text-gray-900"
              >
                Last name
              </label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="Lovelace"
                maxLength={80}
                autoComplete="family-name"
                onChange={() => clearError("lastName")}
              />
              <FieldError>{errors.fields.lastName}</FieldError>
            </div>
          </div>
        )}

        {!isSignIn && (
          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-sm font-medium text-gray-900"
            >
              Phone (optional)
            </label>
            <Input
              id="phone"
              name="phone"
              placeholder="+1 555 010 1234"
              maxLength={20}
              autoComplete="tel"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-900"
          >
            Email address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            onChange={() => clearError("email")}
          />
          <FieldError>{errors.fields.email}</FieldError>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-900"
            >
              Password
            </label>
            {isSignIn && (
              <Link
                to="/forgot"
                className="text-xs font-medium hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input.Password
            id="password"
            name="password"
            placeholder={isSignIn ? "Your password" : "At least 8 characters"}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            onChange={() => clearError("password")}
          />
          <FieldError>{errors.fields.password}</FieldError>
        </div>

        {errors.form && <FormError message={errors.form} />}

        <Button
          type="primary"
          htmlType="submit"
          loading={pending}
          className="w-full"
        >
          {isSignIn ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm">
        <span className="text-gray-600">
          {isSignIn ? "New to Riskio? " : "Already have an account? "}
        </span>
        <Link
          to={isSignIn ? "/signup" : "/"}
          className="font-medium hover:underline"
        >
          {isSignIn ? "Create an account" : "Sign in"}
        </Link>
      </div>
    </div>
  );
}
