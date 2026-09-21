import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { PublicOnlyRoute, ProtectedRoute } from "./guards";
import { SignInPage } from "@/features/auth/pages/SignInPage";
import { SignUpPage } from "@/features/auth/pages/SignUpPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { StormDetailPage } from "@/features/weather/pages/StormDetailsPage";
import { AppLayout } from "@/global_components/AppLayout/AppLayout";

const NotFoundPage = lazy(() =>
  import("@/features/weather/pages/NotFoundPage").then((m) => ({
    default: m.NotFoundPage,
  })),
);

const OAuthCallbackPage = lazy(
  () => import("@/features/auth/pages/OAuthCallbackPage"),
);

const DashboardPage = lazy(() =>
  import("@/features/weather/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);

const HistoryPage = lazy(() =>
  import("@/features/weather/pages/HistoryPage").then((m) => ({
    default: m.HistoryPage,
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
          <Route path="/history" element={<HistoryPage />} />
          <Route path="storms/:atcfId" element={<StormDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
