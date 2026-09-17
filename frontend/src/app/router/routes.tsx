import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Skeleton } from "antd";

import { PublicOnlyRoute, ProtectedRoute } from "./guards";
import { AppLayout } from "@/components/AppLayout/AppLayout";
import { StormDetailPage } from "@/features/storms/pages/StormDetailsPage";
import { AdvisoryDetailPage } from "@/features/storms/pages/AdvisoryDetailsPage";

const DashboardPage = lazy(() =>
  import("@/features/storms/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);

const SignInPage = lazy(() =>
  import("@/features/auth/pages/SignInPage").then((module) => ({
    default: module.SignInPage,
  })),
);

const SignUpPage = lazy(() =>
  import("@/features/auth/pages/SignUpPage").then((module) => ({
    default: module.SignUpPage,
  })),
);

const ForgotPage = lazy(() =>
  import("@/features/auth/pages/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);

const OAuthCallbackPage = lazy(() =>
  import("@/features/auth/pages/OAuthCallbackPage"),
);

function PageFallback() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Skeleton active title paragraph={{ rows: 5 }} />
    </main>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Públicas: si ya hay sesión, el guard redirige a /dashboard */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot" element={<ForgotPage />} />
        </Route>

        {/* OAuth: FUERA de los guards. Es una ruta de tránsito.
            Si estuviera dentro de PublicOnlyRoute y ya hubiera sesión,
            el guard redirigiría a /dashboard antes de procesar el token. */}
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* Protegidas: si no hay sesión, el guard redirige a / */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="storms/:atcfId" element={<StormDetailPage />} />
            <Route path="advisories/:id" element={<AdvisoryDetailPage />} />
          </Route>
        </Route>

        {/* Catch-all: cualquier URL desconocida → login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}