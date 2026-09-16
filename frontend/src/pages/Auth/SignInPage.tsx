import { AuthLayout } from "./AuthLayout";
import { AuthHeader } from "../../components/AuthHeader/AuthHeader";
import { AuthContent } from "../../components/AuthContent/AuthContent";
import {
  CookieBanner,
  useCookieConsent,
} from "../../components/CookieBanner/CookieBanner";

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
