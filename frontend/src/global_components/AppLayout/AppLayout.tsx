import { Outlet } from "react-router-dom";
import { ReactNode, Suspense } from "react";
import { AppHeader } from "../AppHeader/AppHeader";
import { AppFooter } from "../AppFooter/AppFooter";
import { PageFallback } from "../PageFallBack/PageFallBack";
import { useScrollToTop } from "@/hooks/useScrollToTop";

interface AppLayoutProps {
  children?: ReactNode;
}

/**
 * Layout that wraps every authenticated route.
 *
 * Provides the global chrome (header + footer) around the routed page,
 * the accessibility skip-link, and a Suspense boundary for lazily loaded
 * pages. The BackButton is rendered here for now; it will move out of
 * the layout once the individual pages migrate to breadcrumb navigation.
 */
export function AppLayout({ children }: AppLayoutProps) {
  useScrollToTop();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>

      <AppHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8">
          <Suspense fallback={<PageFallback />}>
            {children ?? <Outlet />}
          </Suspense>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
