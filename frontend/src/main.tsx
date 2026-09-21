import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/sora/wght.css";
import "leaflet/dist/leaflet.css";
import App from "./app/App";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./auth/session-context";
import { ThemeProvider } from "./design-system/ThemeProvider";
import "./index.css";
import { resetAllCaches } from "./data/promises";
import { ErrorBoundary } from "./global_components/ErrorBoundary/ErrorBoundary";
import { AppFallback } from "./global_components/AppFallback/AppFallback";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary
        onReset={() => {
          resetAllCaches();
        }}
      >
        <BrowserRouter>
          <SessionProvider>
            <ThemeProvider>
              <Suspense fallback={<AppFallback />}>
                <App />
              </Suspense>
            </ThemeProvider>
          </SessionProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}
