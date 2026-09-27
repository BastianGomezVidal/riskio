import { AuthLayout } from "@/layout/public/AuthLayout";
import { AuthHeader } from "@/layout/public/AuthContent/AuthHeader/AuthHeader";
import { AuthContent } from "@/layout/public/AuthContent/AuthContent";
import {
  CookieBanner,
  useCookieConsent,
} from "@/layout/public/CookieBanner/CookieBanner";

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
