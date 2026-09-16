import { AuthLayout } from "./AuthLayout";
import { AuthHeader } from "../../features/login/AuthHeader/AuthHeader";
import { AuthContent } from "../../features/login/AuthContent/AuthContent";

export function SignUpPage() {
  return (
    <AuthLayout>
      <AuthHeader active="sign-up" />
      <AuthContent mode="sign-up" />
    </AuthLayout>
  );
}
