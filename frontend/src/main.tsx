import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { useQueryClient } from "@tanstack/react-query";
import "@fontsource-variable/sora/wght.css";
import "leaflet/dist/leaflet.css";
import App from "./app/App";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./auth/session-context";
import { ThemeProvider } from "./design-system/ThemeProvider";
import { QueryProvider } from "./data/QueryProvider";
import "./index.css";
import { ErrorBoundary } from "./global_components/ErrorBoundary/ErrorBoundary";
import { AppFallback } from "./global_components/AppFallback/AppFallback";

/**
 * The root boundary sits inside the QueryClientProvider so its retry can drop
 * cached server state: a catastrophic render error is often downstream of bad
 * data, and re-rendering the same cache would fail the same way.
 */
function Root({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  return (
    <ErrorBoundary onReset={() => queryClient.clear()}>
      {children}
    </ErrorBoundary>
  );
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryProvider>
        <Root>
          <BrowserRouter>
            <SessionProvider>
              <ThemeProvider>
                <Suspense fallback={<AppFallback />}>
                  <App />
                </Suspense>
              </ThemeProvider>
            </SessionProvider>
          </BrowserRouter>
        </Root>
      </QueryProvider>
    </StrictMode>,
  );
}
