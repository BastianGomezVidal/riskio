import { Outlet } from "react-router-dom";
import { ReactNode, Suspense } from "react";
import { PageFallback } from "../PageFAllBack/PageFallBack";
import { SiteHeader } from "../SiteHeader/SiteHeader";
import { BackButton } from "../BackButton/BackButton";

interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>

      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
          <BackButton />
          <Suspense fallback={<PageFallback />}>
            {children ?? <Outlet />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
