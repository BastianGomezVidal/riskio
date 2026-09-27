import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { PublicOnlyRoute, ProtectedRoute } from "./guards";
import { SignInPage } from "@/pages/public/SignInPage";
import { SignUpPage } from "@/pages/public/SignUpPage";
import { ForgotPasswordPage } from "@/pages/public/ForgotPasswordPage";
import { StormDetailPage } from "@/pages/protected/StormDetailsPage";
import { AppLayout } from "@/global_components/AppLayout/AppLayout";
import { SettingsPage } from "@/pages/protected/SettingsPage";
import { StormsPage } from "@/pages/protected/StormsPage";

const NotFoundPage = lazy(() =>
  import("@/pages/protected/NotFoundPage").then((m) => ({
    default: m.NotFoundPage,
  })),
);

const OAuthCallbackPage = lazy(
  () => import("@/pages/public/OAuthCallbackPage"),
);

const DashboardPage = lazy(() =>
  import("@/pages/protected/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
      </Route>

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
