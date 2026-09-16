import { useActionState, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "antd";
import {
  api,
  authErrorMessage,
  type ForgotPasswordResult,
} from "../../api/client";
import { EMAIL_PATTERN } from "../../auth/validation";
import {
  FieldError,
  FormError,
} from "../../features/login/AuthError/AuthError";
import { AuthLayout } from "./AuthLayout";

interface ForgotErrors {
  form: string | null;
  field: string | null;
}

const EMPTY_ERRORS: ForgotErrors = { form: null, field: null };

export function ForgotPasswordPage() {
  const [result, setResult] = useState<ForgotPasswordResult | null>(null);
  const [errors, setErrors] = useState<ForgotErrors>(EMPTY_ERRORS);

  const [, formAction, pending] = useActionState(
    async (_previous: ForgotErrors | null, formData: FormData) => {
      const email = String(formData.get("email") ?? "").trim();

      let field: string | null = null;
      if (!email) {
        field = "Enter your email address";
      } else if (!EMAIL_PATTERN.test(email)) {
        field = "Enter a valid email address";
      }

      if (field) {
        setErrors({ form: null, field });
        return null;
      }

      setErrors(EMPTY_ERRORS);
      try {
        setResult(await api.forgotPassword(email));
      } catch (err) {
        setErrors({ form: authErrorMessage(err), field: null });
      }
      return null;
    },
    null,
  );

  function clearFieldError() {
    setErrors((prev) => {
      if (prev.form === null && prev.field === null) return prev;
      return EMPTY_ERRORS;
    });
  }

  if (result) {
    return (
      <AuthLayout>
        <section>
          <h2 className="text-lg font-semibold">Password reset</h2>
          <p className="mt-1 text-sm text-gray-600">
            We sent a temporary password to <strong>{result.email}</strong>.
            Check your inbox and sign in with it, then change it in your
            profile.
          </p>

          <Link
            to="/"
            className="mt-6 block w-full rounded-md bg-gray-900 py-2 text-center text-sm font-medium text-white hover:bg-gray-800"
          >
            Back to sign in
          </Link>
        </section>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <section>
        <h2 className="text-lg font-semibold">Reset your password</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter your account email and we will send you a temporary password.
        </p>

        <form action={formAction} noValidate className="mt-8 space-y-4">
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
              autoFocus
              onChange={clearFieldError}
            />
            <FieldError>{errors.field}</FieldError>
          </div>

          {errors.form && <FormError message={errors.form} />}

          <Button
            type="primary"
            htmlType="submit"
            loading={pending}
            className="w-full"
          >
            Request reset
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link to="/" className="font-medium text-gray-900 hover:underline">
            Back to sign in
          </Link>
        </div>
      </section>
    </AuthLayout>
  );
}
