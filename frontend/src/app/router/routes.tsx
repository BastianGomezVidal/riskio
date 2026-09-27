import { Route, Routes } from "react-router-dom";
import { PublicOnlyRoute, ProtectedRoute } from "./guards";
import { lazyPage } from "./lazyPage";
import { AppLayout } from "@/global_components/AppLayout/AppLayout";

// Every route is loaded on demand. Keeping these imports inside lazy() is what
// keeps leaflet and the per-page component trees out of the initial chunk: the
// sign-in screen should not pay for the storm map.
const SignInPage = lazyPage(
  () => import("@/pages/public/SignInPage"),
  "SignInPage",
);
const SignUpPage = lazyPage(
  () => import("@/pages/public/SignUpPage"),
  "SignUpPage",
);
const ForgotPasswordPage = lazyPage(
  () => import("@/pages/public/ForgotPasswordPage"),
  "ForgotPasswordPage",
);
// Outside PublicOnlyRoute: someone who followed the emailed link while signed
// in must still be able to set a new password.
const ResetPasswordPage = lazyPage(
  () => import("@/pages/public/ResetPasswordPage"),
  "ResetPasswordPage",
);
const OAuthCallbackPage = lazyPage(
  () => import("@/pages/public/OAuthCallbackPage"),
  "default",
);

const DashboardPage = lazyPage(
  () => import("@/pages/protected/DashboardPage"),
  "DashboardPage",
);
const StormsPage = lazyPage(
  () => import("@/pages/protected/StormsPage"),
  "StormsPage",
);
const StormDetailPage = lazyPage(
  () => import("@/pages/protected/StormDetailsPage"),
  "StormDetailPage",
);
const SettingsPage = lazyPage(
  () => import("@/pages/protected/SettingsPage"),
  "SettingsPage",
);
const NotFoundPage = lazyPage(
  () => import("@/pages/protected/NotFoundPage"),
  "NotFoundPage",
);

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/storms" element={<StormsPage />} />
          <Route path="/storms/:atcfId" element={<StormDetailPage />} />
          <Route
            path="/storms/:atcfId/advisories/:n"
            element={<StormDetailPage />}
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
