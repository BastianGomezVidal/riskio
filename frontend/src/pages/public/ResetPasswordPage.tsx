import { useActionState, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ActionButton, TextField } from "@/design-system/controls";
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
            className="mt-6 block w-full rounded-md bg-[#2563EB]! py-2 text-center text-sm font-medium text-white! hover:bg-[#2C6CEE]!"
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
            className="mt-6 block w-full rounded-md bg-[#2563EB]! py-2 text-center text-sm font-medium text-white! hover:bg-[#2C6CEE]!"
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
            <TextField
              id="newPassword"
              name="newPassword"
              type="password"
              label="New password"
              autoComplete="new-password"
              autoFocus
            />
          </div>

          <div>
            <TextField
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm new password"
              autoComplete="new-password"
            />
            <FieldError>{errors.password}</FieldError>
          </div>

          {errors.form && <FormError message={errors.form} />}

          <ActionButton
            type="submit"
            variant="primary"
            loading={pending}
            className="w-full"
          >
            Set new password
          </ActionButton>
        </form>
      </section>
    </AuthLayout>
  );
}
