import { Outlet } from "react-router-dom";
import { ReactNode, Suspense } from "react";
import { AppHeader } from "../AppHeader/AppHeader";
import { AppFooter } from "../AppFooter/AppFooter";
import { PageFallback } from "../PageFallBack/PageFallBack";
import { RouteErrorBoundary } from "../ErrorBoundary/RouteErrorBoundary";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { ThemeProvider } from "@/design-system/ThemeProvider";

interface AppLayoutProps {
  children?: ReactNode;
}

/**
 * The skip link.
 *
 * It is the first element inside the layout and nothing portals it, which is the
 * whole point: a skip link exists to be the *first* thing Tab reaches
 * (WCAG 2.4.1, Bypass Blocks). An earlier version rendered it through
 * `createPortal` into `<body>` to win the stacking fight with the header, and
 * that is exactly what broke it. A portal appends to the end of the body, so the
 * link became the *last* focusable element in the document and you had to tab
 * through the whole page to reach it.
 *
 * Stacking does not need a portal. Measured, not assumed: the parent flex
 * container creates no stacking context, the link is `fixed` at `z-50` against
 * the header's `z-30`, and `document.elementFromPoint` over the header returns
 * the link. First in the tab order and on top of the header, without the two
 * requirements fighting each other.
 *
 * A full-width bar rather than a small slab, because a slab reads as a button
 * sitting on the page, which is the opposite of "you are now somewhere else".
 * Its contents reuse the header's own container, so the label sits on the same
 * left edge and measure as the navigation it replaces.
 *
 * Kept outside `<header>` on purpose. GOV.UK, USWDS and the a11y project all put
 * the skip link as the first element of the body, *before* the landmark. Inside
 * the nav it would be a non-navigation link inside a navigation landmark, which
 * is what a screen reader's landmark menu is for.
 *
 * `sr-only` until focused. `focus-visible` and not `focus`, so tabbing reveals it
 * and a click does not; the trade-off is that `:focus-visible` leans on the
 * browser's heuristic where `:focus` always shows.
 *
 * On focus it becomes `static`, so it takes up real space in the flex column and
 * pushes the header down instead of covering it. It was `fixed` and overlaid the
 * header, which is the common implementation but the wrong one here: the link
 * appears over a header the user has not scrolled away from, so it hides the
 * navigation rather than offering it, and the first thing on screen is a bar
 * with unrelated blue showing through beside it. The cost is a reflow when it
 * reveals, which is a fair trade for not hiding the thing it is offering.
 *
 * Nothing here moves focus on navigation. A skip link is a target the user
 * chooses with Tab; auto-focusing it would put Enter one press away from firing
 * it for anyone who merely pressed Tab.
 *
 * White on gray[900] is 17.7:1, so this clears AAA rather than sitting on the AA
 * line.
 */
function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus-visible:not-sr-only focus-visible:static focus-visible:w-full focus-visible:bg-gray-900 focus-visible:text-white"
    >
      <span className="mx-auto flex w-full max-w-6xl items-center px-4 py-3 text-base font-semibold sm:px-6 lg:px-8">
        Skip to main content
      </span>
    </a>
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
 *
 * This is also where `ThemeProvider` now lives. It renders antd's
 * `ConfigProvider` and `AntdApp`, so while it sat in `main.tsx` every public
 * page inherited antd: the sign-in page downloaded a 182 KiB vendor chunk it
 * never used, because the bundler follows the import graph on sight rather than
 * on render. Only authenticated routes are inside this layout, so only they pay
 * for it. Public pages style themselves from the design tokens instead.
 */
export function AppLayout({ children }: AppLayoutProps) {
  useScrollToTop();
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
