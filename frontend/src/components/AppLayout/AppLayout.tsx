import { Outlet } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader/SiteHeader";
import { BackButton } from "@/components/BackButton/BackButton";

export function AppLayout() {
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
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <BackButton />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
