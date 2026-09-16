// src/App.tsx
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Skeleton } from "antd";

import { ProtectedRoute } from "./routes/Protected/ProtectedRoute";
import { PublicOnlyRoute } from "./routes/Public/PublicRoute";

const SignInPage = lazy(() =>
  import("./pages/Auth/SignInPage").then((module) => ({
    default: module.SignInPage,
  })),
);

const SignUpPage = lazy(() =>
  import("./pages/Auth/SignUpPage").then((module) => ({
    default: module.SignUpPage,
  })),
);

const ForgotPage = lazy(() =>
  import("./pages/Auth/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);

const Dashboard = lazy(() =>
  import("./pages/Dashboard/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);

const OAuthCallback = lazy(() => import("./auth/oauthCallback"));

function PageFallback() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Skeleton active title paragraph={{ rows: 5 }} />
    </main>
  );
}

export default function App() {
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
        <Route path="/auth/callback" element={<OAuthCallback />} />

        {/* Protegidas: si no hay sesión, el guard redirige a / */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Catch-all: cualquier URL desconocida → login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
