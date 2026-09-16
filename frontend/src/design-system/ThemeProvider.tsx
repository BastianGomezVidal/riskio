import type { ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import { antdTheme } from "./antd/theme";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Applies the Riskio antd theme and provides context-aware static helpers
 * (message/notification/modal) so they honour the current theme.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}