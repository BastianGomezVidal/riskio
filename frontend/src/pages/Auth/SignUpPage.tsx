import { AuthLayout } from "./AuthLayout";
import { AuthHeader } from "../../components/AuthHeader/AuthHeader";
import { AuthContent } from "../../components/AuthContent/AuthContent";

export function SignUpPage() {
  return (
    <AuthLayout>
      <AuthHeader active="sign-up" />
      <AuthContent mode="sign-up" />
    </AuthLayout>
  );
}
