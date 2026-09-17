import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource-variable/sora/wght.css";
import "leaflet/dist/leaflet.css";

import App from "./app/App";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./auth/session-context";
import { ThemeProvider } from "./design-system/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import "./index.css";
import { resetAllCaches } from "./data/promises";

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
              <App />
            </ThemeProvider>
          </SessionProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}
