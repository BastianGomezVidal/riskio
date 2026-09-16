import type { ThemeConfig } from "antd";
import { semantic } from "../tokens/semantic";

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: semantic.colors.primary,
    colorText: semantic.colors.textPrimary,
    colorTextSecondary: semantic.colors.textSecondary,
    colorTextPlaceholder: semantic.colors.textPlaceholder,
    colorBgBase: semantic.colors.background,
    colorBorder: semantic.colors.borderDefault,

    colorError: semantic.colors.error,
    colorSuccess: semantic.colors.success,

    fontFamily: semantic.typography.fontFamily,
    fontSize: 16,
    fontWeightStrong: semantic.typography.fontWeight.semibold,
    lineHeight: semantic.typography.lineHeight.normal,

    borderRadius: 8,
  },
};
