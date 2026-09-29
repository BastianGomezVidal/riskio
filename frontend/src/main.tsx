import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { useQueryClient } from "@tanstack/react-query";
import "@fontsource-variable/sora/wght.css";
import App from "./app/App";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./auth/session-context";
import { ThemeProvider } from "./design-system/ThemeProvider";
import { QueryProvider } from "./data/QueryProvider";
import "./index.css";
import { ErrorBoundary } from "./global_components/ErrorBoundary/ErrorBoundary";
import { PageFallback } from "./global_components/PageFallBack/PageFallBack";
import { initTracing } from "./observability/telemetry";
import { reportWebVitals } from "./observability/web-vitals";

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
                <Suspense fallback={<PageFallback />}>
                  <App />
                </Suspense>
              </ThemeProvider>
            </SessionProvider>
          </BrowserRouter>
        </Root>
      </QueryProvider>
    </StrictMode>,
  );

  // After the first render, so LCP has a value to report and the tracing SDK
  // lands off the critical path.
  queueMicrotask(() => reportWebVitals());

  // And then only once the browser is idle, which is a different and later
  // moment. Loading the SDK right after the first render looked harmless and
  // was not: ~85 kB of zone.js and the tracing SDK arrived while React was
  // still mounting, competing for the same throttled bandwidth that the render
  // needed, and LCP went up. requestIdleCallback is precisely "not while the
  // page needs you". Neither branch is awaited: a session that never reports is
  // a missing metric, not a broken page.
  const loadTelemetry = () => void initTracing();
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback(loadTelemetry, { timeout: 2000 });
  } else {
    setTimeout(loadTelemetry, 1000);
  }
}
