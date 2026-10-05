import { AuthLayout } from "@/components/layout/AuthLayout";
import { AuthHeader } from "@/components/layout/AuthContent/AuthHeader/AuthHeader";
import { AuthContent } from "@/components/layout/AuthContent/AuthContent";

export function SignUpPage() {
  return (
    <AuthLayout>
      <AuthHeader active="sign-up" />
      <AuthContent mode="sign-up" />
    </AuthLayout>
  );
}
