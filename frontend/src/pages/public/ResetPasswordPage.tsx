import { useActionState, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Input } from "antd";
import { api, authErrorMessage } from "@/api/client";
import { FieldError, FormError } from "@/layout/public/AuthError/AuthError";
import { AuthLayout } from "@/layout/public/AuthLayout";

interface ResetErrors {
  form: string | null;
  password: string | null;
}

const EMPTY_ERRORS: ResetErrors = { form: null, password: null };

const MIN_PASSWORD_LENGTH = 4;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  // `undefined` while the URL has not been read yet, so the page does not
  // flash "invalid link" before the effect runs.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [errors, setErrors] = useState<ResetErrors>(EMPTY_ERRORS);
  const [done, setDone] = useState<string | null>(null);

  // Read the token once, then take it out of the address bar. Leaving it there
  // means it can leak through the Referer header on the next navigation, and it
  // lingers in history and in bookmarks.
  useEffect(() => {
    const fromUrl = searchParams.get("token");
    setToken(fromUrl);
    if (fromUrl) window.history.replaceState(null, "", "/reset-password");
  }, [searchParams]);

  const [, formAction, pending] = useActionState(
    async (_previous: ResetErrors | null, formData: FormData) => {
      const newPassword = String(formData.get("newPassword") ?? "");
      const confirmation = String(formData.get("confirmPassword") ?? "");

      if (!token) {
        setErrors({
          form: "This link is missing its token",
          password: null,
        });
        return null;
      }

      let password: string | null = null;
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
      } else if (newPassword !== confirmation) {
        password = "Both passwords must match";
      }

      if (password) {
        setErrors({ form: null, password });
        return null;
      }

      setErrors(EMPTY_ERRORS);
      try {
        const result = await api.resetPassword({ token, newPassword });
        setToken(null);
        setDone(result.message);
      } catch (err) {
        setErrors({ form: authErrorMessage(err), password: null });
      }
      return null;
    },
    null,
  );

  if (done) {
    return (
      <AuthLayout>
        <section>
          <h2 className="text-lg font-semibold">Password updated</h2>
          <p className="mt-1 text-sm text-gray-600">{done}</p>

          <Link
            to="/"
            className="mt-6 block w-full rounded-md bg-gray-900 py-2 text-center text-sm font-medium text-white hover:bg-gray-800"
          >
            Go to sign in
          </Link>
        </section>
      </AuthLayout>
    );
  }

  if (token === undefined) {
    return (
      <AuthLayout>
        <section>
          <h2 className="text-lg font-semibold">Choose a new password</h2>
          <p className="mt-1 text-sm text-gray-600">Checking your link…</p>
        </section>
      </AuthLayout>
    );
  }

  if (token === null) {
    return (
      <AuthLayout>
        <section>
          <h2 className="text-lg font-semibold">Reset link</h2>
          <p className="mt-1 text-sm text-gray-600">
            This link is not valid any more. Request a new one and try again.
          </p>

          <Link
            to="/forgot"
            className="mt-6 block w-full rounded-md bg-gray-900 py-2 text-center text-sm font-medium text-white hover:bg-gray-800"
          >
            Request a new link
          </Link>
        </section>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <section>
        <h2 className="text-lg font-semibold">Choose a new password</h2>
        <p className="mt-1 text-sm text-gray-600">
          This link works once. After you set the new password, the link stops
          being valid.
        </p>

        <form action={formAction} noValidate className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1 block text-sm font-medium text-gray-900"
            >
              New password
            </label>
            <Input.Password
              id="newPassword"
              name="newPassword"
              autoComplete="new-password"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-gray-900"
            >
              Confirm new password
            </label>
            <Input.Password
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
            />
            <FieldError>{errors.password}</FieldError>
          </div>

          {errors.form && <FormError message={errors.form} />}

          <Button
            type="primary"
            htmlType="submit"
            loading={pending}
            className="w-full"
          >
            Set new password
          </Button>
        </form>
      </section>
    </AuthLayout>
  );
}
