import { AuthLayout } from "./AuthLayout";
import { AuthHeader } from "../../features/login/AuthHeader/AuthHeader";
import { AuthContent } from "../../features/login/AuthContent/AuthContent";
import {
  CookieBanner,
  useCookieConsent,
} from "../../features/login/CookieBanner/CookieBanner";

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
