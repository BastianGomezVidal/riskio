import { AuthLayout } from "@/components/layout/AuthLayout";
import { AuthHeader } from "@/components/layout/AuthContent/AuthHeader/AuthHeader";
import { AuthContent } from "@/components/layout/AuthContent/AuthContent";
import {
  CookieBanner,
  useCookieConsent,
} from "@/components/layout/CookieBanner/CookieBanner";

export function SignInPage() {
  const [consent, onConsent] = useCookieConsent();

  return (
    <AuthLayout
      footer={<CookieBanner consent={consent} onConsent={onConsent} />}
    >
      <AuthHeader active="sign-in" />
      <AuthContent mode="sign-in" />
    </AuthLayout>
  );
}
