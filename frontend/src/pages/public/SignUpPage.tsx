import { AuthLayout } from "@/layout/public/AuthLayout";
import { AuthHeader } from "@/layout/public/AuthContent/AuthHeader/AuthHeader";
import { AuthContent } from "@/layout/public/AuthContent/AuthContent";

export function SignUpPage() {
  return (
    <AuthLayout>
      <AuthHeader active="sign-up" />
      <AuthContent mode="sign-up" />
    </AuthLayout>
  );
}
