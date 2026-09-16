import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource-variable/sora/wght.css";

import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./auth/session-context";
import { ThemeProvider } from "./design-system/ThemeProvider";
import { ErrorBoundary } from "./features/general/ErrorBoundary/ErrorBoundary";
import "./index.css";
import { resetHealth, resetStorms } from "./api/promises";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary
        onReset={() => {
          resetHealth();
          resetStorms();
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
