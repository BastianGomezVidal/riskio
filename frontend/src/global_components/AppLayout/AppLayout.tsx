import { Outlet } from "react-router-dom";
import { ReactNode, Suspense } from "react";
import { createPortal } from "react-dom";
import { AppHeader } from "../AppHeader/AppHeader";
import { AppFooter } from "../AppFooter/AppFooter";
import { PageFallback } from "../PageFallBack/PageFallBack";
import { RouteErrorBoundary } from "../ErrorBoundary/RouteErrorBoundary";
import { useScrollToTop } from "@/hooks/useScrollToTop";

interface AppLayoutProps {
  children?: ReactNode;
}

/**
 * The skip link, portalled into `<body>`.
 *
 * Portalled rather than rendered in place because the layout is a flex column
 * that the header sits inside: anything here is a sibling of the header, not an
 * overlay on it, so it competes for the same stacking context and depends on
 * winning a z-index fight. In `<body>` it is above everything by construction.
 *
 * It is a full-width bar, not a small slab. A slab reads as a button sitting on
 * the page, which is the opposite of "you are now somewhere else". The bar
 * spans the viewport and its contents reuse the header's own container
 * (`max-w-6xl` and the same responsive padding), so the label sits on the same
 * left edge and measure as the navigation it is replacing.
 *
 * `sr-only` until focused. `focus-visible` and not `focus`, so tabbing reveals
 * it and a mouse click does not; the trade-off is that `:focus-visible` leans on
 * the browser's heuristic where `:focus` always shows. `inset-x-0` rather than
 * `w-full` so that revealing it cannot collide with `not-sr-only` resetting
 * `width` to `auto`.
 *
 * White on grey[900] is 17.7:1, so this clears AAA rather than sitting on the AA
 * line, and the label is 16px semibold so it is not carried by size alone.
 */
function SkipLink() {
  if (typeof document === "undefined") return null;

  return createPortal(
    <a
      href="#main"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:inset-x-0 focus-visible:top-0 focus-visible:z-50 focus-visible:bg-gray-900 focus-visible:text-white"
    >
      <span className="mx-auto flex w-full max-w-6xl items-center px-4 py-3 text-base font-semibold sm:px-6 lg:px-8">
        Skip to main content
      </span>
    </a>,
    document.body,
  );
}

/**
 * Layout that wraps every authenticated route.
 *
 * Provides the global chrome (header + footer) around the routed page,
 * the accessibility skip-link, a Suspense boundary for lazily loaded
 * pages, and an Error Boundary scoped to the page. The BackButton is
 * rendered here for now; it will move out of the layout once the
 * individual pages migrate to breadcrumb navigation.
 */
export function AppLayout({ children }: AppLayoutProps) {
  useScrollToTop();
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />

      <AppHeader />

      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8">
          <RouteErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              {children ?? <Outlet />}
            </Suspense>
          </RouteErrorBoundary>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
