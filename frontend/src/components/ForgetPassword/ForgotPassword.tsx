import { useActionState, useState } from "react";
import { Alert, Button, Input, Typography } from "antd";
import { api, authErrorMessage, type ForgotPasswordResult } from "../../api/client";
import { EMAIL_PATTERN } from "../../auth/validation";
import { FieldError, FormError } from "../AuthError/AuthError";

interface ForgotPasswordProps {
  onBack: () => void;
  /** Sign in straight away with the returned temporary password. */
  onSignIn: (email: string, password: string) => void;
}

interface ForgotErrors {
  form: string | null;
  field: string | null;
}

const EMPTY_ERRORS: ForgotErrors = { form: null, field: null };

export function ForgotPassword({ onBack, onSignIn }: ForgotPasswordProps) {
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
      if (prev.form === null && prev.field === null) {
        return prev;
      }
      return EMPTY_ERRORS;
    });
  }

  if (result) {
    return (
      <div className="mt-6">
        <header className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Riskio</h1>
        </header>

        <div className="mt-6">
          <h2 className="text-lg font-semibold">Password reset</h2>
          <p className="mt-1 text-sm text-gray-600">
            Sign in with this temporary password, then change it in your profile.
          </p>

          <Alert
            className="mt-4"
            type="success"
            showIcon
            message="Temporary password"
            description={
              <Typography.Text copyable strong>
                {result.temporaryPassword}
              </Typography.Text>
            }
          />

          <Button
            type="primary"
            className="mt-4 w-full"
            onClick={() => onSignIn(result.email, result.temporaryPassword)}
          >
            Sign in with temporary password
          </Button>

          <div className="mt-4 text-center text-sm">
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onBack();
              }}
              className="font-medium text-gray-900 hover:underline"
            >
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <header className="flex flex-col items-center gap-4">
        <h1 className="text-xl font-semibold">Riskio</h1>
      </header>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Reset your password</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter your account email and we will reset your password.
        </p>
      </div>

      <form action={formAction} noValidate className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-900">
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

        <Button type="primary" htmlType="submit" loading={pending} className="w-full">
          Request reset
        </Button>
      </form>

      <div className="mt-4 text-center text-sm">
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onBack();
          }}
          className="font-medium text-gray-900 hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}